import User from "../models/User.js";
import File from "../models/File.js";
export const getAllUsersWithStats = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    const usersWithStats = await Promise.all(
      users.map(async user => {
        const files = await File.find({
          userId: user._id,
          isTrashed: false
        });

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        return {
          ...user.toObject(),
          storageUsed: totalSize,
          fileCount: files.length
        };
      })
    );

    res.json(usersWithStats);
  } catch (err) {
    console.error("Admin users fetch error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};
export const downgradeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // prevent admin from downgrading another admin (optional safety)
    if (user.role === "admin") {
      return res.status(400).json({
        message: "Cannot downgrade an admin account",
      });
    }
    user.plan = "free";
    user.storageLimit = 50 * 1024 * 1024 * 1024; // 50GB
    await user.save();
    res.json({
      success: true,
      message: "User downgraded successfully",
    });
  } catch (err) {
    console.error("Downgrade error:", err);
    res.status(500).json({ message: "Server error" });
  }
};