import Folder from "../models/Folder.js";
import File from "../models/File.js";

export const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id; // from JWT middleware

    // 1️⃣ Delete all files inside this folder
    await File.deleteMany({
      folderId: folderId,
      userId: userId
    });

    // 2️⃣ Delete the folder itself
    const deletedFolder = await Folder.findOneAndDelete({
      _id: folderId,
      userId: userId
    });

    if (!deletedFolder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    res.json({
      message: "Folder and all contained files deleted successfully"
    });
  } catch (err) {
    console.error("Delete folder error:", err);
    res.status(500).json({ message: "Failed to delete folder" });
  }
};
