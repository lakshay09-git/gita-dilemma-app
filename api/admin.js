const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in the Vercel project settings.' });
  }

  const supplied = (req.query && req.query.password) || '';

  if (supplied !== expected) {
    return res.status(401).json({ error: 'Wrong password.' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage is not connected to this project yet.' });
  }

  try {
    const result = await list({ prefix: 'dilemmas/', limit: 200 });

    const entries = await Promise.all(
      result.blobs.map(async function (blob) {
        try {
          const response = await fetch(blob.downloadUrl || blob.url);
          const record = await response.json();
          return {
            savedAt: record.savedAt || blob.uploadedAt,
            dilemma: record.dilemma || '',
            guidance: record.guidance || ''
          };
        } catch (error) {
          return null;
        }
      })
    );

    const clean = entries
      .filter(function (entry) { return entry !== null; })
      .sort(function (a, b) { return new Date(b.savedAt) - new Date(a.savedAt); });

    return res.status(200).json({ count: clean.length, entries: clean });
  } catch (error) {
    console.error('Admin list failed:', error && error.message);
    return res.status(500).json({ error: 'Could not read the archive.' });
  }
};
