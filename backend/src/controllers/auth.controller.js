import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { Cart } from "../models/misc.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  unauthorized,
} from "../utils/http.js";
import { clearSession, issueSession } from "../middleware/auth.js";
import {
  findProfile,
  profileView,
  saveProfile,
} from "../services/customerProfile.service.js";

export async function register(req, res) {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email }))
    throw conflict(
      "An account with that email already exists. Try signing in.",
      { fields: { email: "Already registered" } },
    );
  const user = new User({ name, email, phone: phone || "", role: "customer" });
  await user.setPassword(password);
  await user.save();
  issueSession(res, user);
  res.status(201).json({ user: user.toSafeJSON() });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (user?.googleId)
    throw unauthorized(
      "This account signs in with Google. Use the Google button.",
    );
  if (!user || !user.active || !(await user.checkPassword(password)))
    throw unauthorized("Email or password is incorrect.");
  user.lastLoginAt = new Date();
  await user.save();
  issueSession(res, user);
  res.json({ user: user.toSafeJSON() });
}

const googleClient = new OAuth2Client();

/**
 * Sign in with Google. The token is checked with Google on the server, and the
 * account is matched by Google's user id, then by verified email for a first sign-in.
 */
export async function googleSignIn(req, res) {
  if (!env.googleClientId)
    throw new AppError(503, "Google sign-in is not set up yet.");

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized("Google sign-in failed. Please try again.");
  }
  if (!payload?.sub || !payload.email || !payload.email_verified)
    throw unauthorized("Your Google email address is not verified.");

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ googleId: payload.sub }).select(
    "+passwordHash",
  );
  if (!user) user = await User.findOne({ email }).select("+passwordHash");

  // Admin accounts keep their password, so a Google account alone can't open the admin panel
  if (user?.role === "staff")
    throw forbidden("Staff accounts sign in with email and password.");
  if (user && !user.active)
    throw forbidden("This account is not active. Please contact the bakery.");

  let created = false;
  if (user) {
    if (!user.googleId) {
      // Google has proved who owns this email. Removing the old password stops anyone
      // who registered with this address earlier, without owning it, from signing in.
      user.googleId = payload.sub;
      user.passwordHash = undefined;
    }
  } else {
    user = new User({
      name: (payload.name || email.split("@")[0]).slice(0, 120),
      email,
      googleId: payload.sub,
      role: "customer",
    });
    created = true;
  }
  user.lastLoginAt = new Date();
  try {
    await user.save();
  } catch (err) {
    // Two sign-ins at the same moment: use the account the other one created
    if (err.code !== 11000) throw err;
    user = await User.findOne({ googleId: payload.sub });
    if (!user) throw err;
    created = false;
  }
  issueSession(res, user);
  res.status(created ? 201 : 200).json({ user: user.toSafeJSON(), created });
}

export function logout(_req, res) {
  clearSession(res);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user ? req.user.toSafeJSON() : null });
}

export async function updateProfile(req, res) {
  const { dob, address, whatsappOptIn, ...account } = req.body;
  Object.assign(req.user, account);
  await req.user.save();
  // Birthday, address and WhatsApp consent live in the customer's profile, which the bakery can see
  const extras = {};
  if (dob !== undefined) extras.dob = dob;
  if (address !== undefined) extras.address = address;
  if (whatsappOptIn !== undefined) extras.whatsappOptIn = whatsappOptIn;
  if (req.user.role !== "customer")
    return res.json({ user: req.user.toSafeJSON(), profile: null });
  const profile = await saveProfile(
    { user: req.user._id, email: req.user.email, phone: req.user.phone },
    {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      ...extras,
    },
    "customer",
  );
  res.json({ user: req.user.toSafeJSON(), profile: profileView(profile) });
}

export async function profileDetails(req, res) {
  const profile = await findProfile({
    user: req.user._id,
    email: req.user.email,
    phone: req.user.phone,
  });
  res.json({ profile: profileView(profile) });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (user.googleId)
    throw badRequest(
      "This account signs in with Google, so it has no password to change.",
    );
  if (!(await user.checkPassword(req.body.currentPassword)))
    throw badRequest("Current password is incorrect.", {
      fields: { currentPassword: "Incorrect password" },
    });
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.json({ ok: true });
}

// ── Persisted cart for signed-in customers ──
export async function getCart(req, res) {
  const cart = await Cart.findOne({ user: req.user._id });
  res.json({ items: cart?.items || [] });
}

export async function saveCart(req, res) {
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: req.body.items },
    { upsert: true, new: true },
  );
  res.json({ items: cart.items });
}
