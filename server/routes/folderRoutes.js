import express from "express";
import Folder from "../models/Folder.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { generateUniqueFolderName } from "../utils/folderNameHelper.js";
import archiver from "archiver";
import File from "../models/File.js";
import path from "path";
import fs from "fs";
import { deleteFolder } from "../controllers/folderController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();
const addFolderToZip = async (archive, folderId, zipPath) => {
  // add files in this folder
  const files = await File.find({ folderId });

  for (const file of files) {
    archive.file(file.path, {
      name: path.join(zipPath, file.name)
    });
  }

  // find subfolders
  const subfolders = await Folder.find({ parentFolder: folderId });

  for (const sub of subfolders) {
    await addFolderToZip(
      archive,
      sub._id,
      path.join(zipPath, sub.name)
    );
  }
};

/* ================= DOWNLOAD FOLDER ================= */
router.get("/:id/download", authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${folder.name}.zip"`
    );
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // ✅ rebuild full folder tree
    await addFolderToZip(archive, folder._id, folder.name);

    await archive.finalize();
  } catch (err) {
    console.error("FOLDER DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Folder download failed" });
  }
});

/* ================= CREATE FOLDER ================= */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const uniqueName = await generateUniqueFolderName({
      userId: req.user.id,
      parentFolder: req.body.parentFolder || null,
      name: req.body.name
    });

    const folder = new Folder({
      name: uniqueName,
      userId: req.user.id,
      parentFolder: req.body.parentFolder || null
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create folder" });
  }
});

/* ================= GET USER FOLDERS ================= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.user.id });
    res.json(folders);
  } catch {
    res.status(500).json({ message: "Failed to fetch folders" });
  }
});

/* ================= RENAME FOLDER ================= */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    const uniqueName = await generateUniqueFolderName({
      userId: req.user.id,
      parentFolder: folder.parentFolder,
      name: req.body.name
    });

    folder.name = uniqueName;
    await folder.save();

    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Rename failed" });
  }
});

/* ================= DELETE FOLDER ================= */
router.delete("/:folderId", authMiddleware, deleteFolder);

export default router;
