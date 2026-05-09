import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    path: String,
    size: Number,
    category: String,

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    isTrashed: {
      type: Boolean,
      default: false,
    }

  },
  { timestamps: true }
);

export default mongoose.model("File", fileSchema);
