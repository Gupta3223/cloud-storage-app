// routes/userRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// Upgrade plan endpoint (fake payment)
router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select(
    "plan storageUsed"
  );

  const storageLimit =
    user.plan === "pro"
      ? 50 * 1024 * 1024 * 1024
      : 10 * 1024 * 1024 * 1024;

  res.json({
    _id: user._id,
    plan: user.plan,
    storageUsed: user.storageUsed,
    storageLimit,
  });
});

router.post("/upgrade", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.plan = "pro";
    await user.save();

    const storageLimit = 50 * 1024 * 1024 * 1024;

    if (req.io) {
      req.io.to(`user:${user._id}`).emit("user-plan-updated", {
        plan: user.plan,
        storageLimit,
      });
    }

    res.json({
      success: true,
      message: "Upgraded to Pro successfully",
      user: {
        plan: user.plan,
        storageLimit,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Upgrade failed" });
  }
});

router.post("/downgrade", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.plan = "free";
    await user.save();

    const storageLimit = 10 * 1024 * 1024 * 1024;

    if (req.io) {
      req.io.to(`user:${user._id}`).emit("user-plan-updated", {
        plan: user.plan,
        storageLimit,
      });
    }

    res.json({
      success: true,
      message: "Downgraded to Free",
    });
  } catch (err) {
    res.status(500).json({ message: "Downgrade failed" });
  }
});

export default router;