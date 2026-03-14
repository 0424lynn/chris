/**
 * migrate.js — Run ONCE to import all *modelData.json files into MongoDB.
 * Usage: node migrate.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not set in .env'); process.exit(1); }

// Schema: _id = filename without .json (e.g. "MSFmodelData"), data = full JSON
const ModelData = mongoose.model(
  'ModelData',
  new mongoose.Schema({ _id: String, data: Object }, { strict: false }),
  'modeldata'
);

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('modelData.json'));
  console.log(`Found ${files.length} files to import:\n`);

  let ok = 0, fail = 0;
  for (const file of files) {
    try {
      const fileKey = file.replace('.json', '');
      const data    = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      await ModelData.findByIdAndUpdate(
        fileKey,
        { _id: fileKey, data },
        { upsert: true, new: true }
      );
      console.log(`  ✅ ${file}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${file} — ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} imported, ${fail} failed.`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
