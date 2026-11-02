import mongoose from 'mongoose';
import { env } from '../config/env.js';

// Use whichever bcrypt library your project has installed
let bcrypt;
try {
  bcrypt = (await import('bcryptjs')).default;
} catch {
  bcrypt = (await import('bcrypt')).default;
}

const email = (process.argv[2] || env.seedAdminEmail).trim().toLowerCase();
const newPassword = process.argv[3];

if (!newPassword) {
  console.error('Usage: node src/seed/resetAdminPassword.js <email> <newPassword>');
  process.exit(1);
}
if (!env.mongoUri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

await mongoose.connect(env.mongoUri);
const db = mongoose.connection.db;

console.log('Connected to database:', db.databaseName);

const collections = await db.listCollections().toArray();
console.log('Collections:', collections.map((c) => c.name));

// Show any documents that have an email field, so you can see what is stored
for (const c of collections) {
  const docs = await db
    .collection(c.name)
    .find({ email: { $exists: true } }, { projection: { email: 1, role: 1 } })
    .limit(5)
    .toArray();
  if (docs.length) console.log(`\n${c.name}:`, docs);
}

// Find the user in any collection (case-insensitive email match)
const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emailQuery = { email: { $regex: `^${escaped}$`, $options: 'i' } };

let updated = false;
for (const c of collections) {
  const col = db.collection(c.name);
  const user = await col.findOne(emailQuery);
  if (!user) continue;

  // Detect the password field name used in your schema
  const field = ['password', 'passwordHash', 'hashedPassword'].find((f) => f in user) || 'password';

  const hash = await bcrypt.hash(newPassword, 10);
  await col.updateOne({ _id: user._id }, { $set: { [field]: hash } });

  console.log(`\nPassword updated for ${user.email} in collection "${c.name}" (field: ${field})`);
  updated = true;
  break;
}

if (!updated) {
  console.log(`\nNo user found with ${email} in database "${db.databaseName}".`);
  console.log('Check the database name above. If it is "test" or empty, add your DB name to MONGODB_URI.');
}

await mongoose.disconnect();