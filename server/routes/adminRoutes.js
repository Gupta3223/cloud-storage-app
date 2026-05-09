import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import User from "../models/User.js";
import {
  getAllUsersWithStats,
  downgradeUser
} from "../controllers/adminController.js";

const router = express.Router();

router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  getAllUsersWithStats
);

router.post(
  "/users/:id/downgrade",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "admin") {
        return res.status(400).json({
          message: "Cannot downgrade an admin account",
        });
      }

      user.plan = "free";
      await user.save();

      if (req.io) {
        req.io.to(`user:${user._id}`).emit("user-plan-updated", {
          plan: user.plan,
        });
      }

      res.json({
        success: true,
        message: "User downgraded to Free",
      });
    } catch (err) {
      console.error("Downgrade error:", err);
      res.status(500).json({ message: "Downgrade failed" });
    }
  }
);

// Promote to Admin
router.post("/users/:id/promote", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { role: "admin" });
    res.json({ message: "User promoted to admin" });
  } catch (err) {
    res.status(500).json({ message: "Promotion failed" });
  }
});

// Demote Admin
router.post("/users/:id/demote", authMiddleware, adminMiddleware , async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { role: "user" });
    res.json({ message: "Admin demoted to user" });
  } catch (err) {
    res.status(500).json({ message: "Demotion failed" });
  }
});

export default router;
