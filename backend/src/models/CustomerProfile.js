import mongoose from 'mongoose';

// Extra details about a customer: birthday, address and WhatsApp consent.
// Works for registered customers (linked by `user`) and for guests or counter customers (found by phone or email).
const customerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    name: { type: String, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '', index: true },
    phone: { type: String, trim: true, default: '' },
    // Last 9 digits of the phone, so +61 412 345 678 and 0412 345 678 find the same profile
    phoneKey: { type: String, default: '', index: true },
    dob: {
      day: { type: Number, min: 1, max: 31 },
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number, min: 1900, max: 2100 },
    },
    // Wedding anniversary, same shape as the birthday
    anniversary: {
      day: { type: Number, min: 1, max: 31 },
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number, min: 1900, max: 2100 },
    },
    address: { line1: String, suburb: String, state: String, postcode: String },
    // Spam Act: proof of when and how the customer agreed to marketing messages on WhatsApp
    whatsapp: {
      optIn: { type: Boolean, default: false },
      at: Date, // when they said yes
      by: String, // 'customer' (ticked it themselves) or the staff member who recorded it
      optOutAt: Date,
    },
    updatedBy: String,
  },
  { timestamps: true },
);

customerProfileSchema.index({ 'dob.month': 1, 'dob.day': 1 });
customerProfileSchema.index({ 'anniversary.month': 1, 'anniversary.day': 1 });
customerProfileSchema.set('toJSON', { versionKey: false });

export const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);