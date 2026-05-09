// controllers/fileController.js
import File from "../models/File.js";
import User from "../models/User.js";
import { io } from "../server.js";

export const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 1️⃣ Save file
    const savedFile = await File.create({
      name: file.originalname,
      path: file.path,
      size: file.size,
      category: req.body.category,
      folderId: req.body.folderId || null,
      userId,
      isTrashed: false
    });

    // 2️⃣ Update user storage
    const user = await User.findById(userId);
    user.storageUsed += file.size;
    user.fileCount += 1;
    await user.save();

    io.to("admins").emit("storage-updated");

    res.status(201).json(savedFile);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "File upload failed" });
  }
};

export const getFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const files = await File.find({
      userId,
      isTrashed: false // ✅ THIS FIXES EMPTY DASHBOARD
    }).sort({ createdAt: -1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch files" });
  }
};

export const trashFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const file = await File.findOne({
      _id: fileId,
      userId,
      isTrashed: false
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Soft delete
    file.isTrashed = true;
    await file.save();

    // Reduce storage
    const user = await User.findById(userId);
    user.storageUsed = Math.max(0, user.storageUsed - file.size);
    user.fileCount = Math.max(0, user.fileCount - 1);
    await user.save();

    res.json({ message: "File moved to trash" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

export const restoreFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const file = await File.findOne({
      _id: fileId,
      userId,
      isTrashed: true
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    file.isTrashed = false;
    await file.save();

    const user = await User.findById(userId);
    user.storageUsed += file.size;
    user.fileCount += 1;
    await user.save();

    res.json({ message: "File restored" });
  } catch (err) {
    res.status(500).json({ message: "Restore failed" });
  }
};
