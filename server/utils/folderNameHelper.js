import Folder from "../models/Folder.js";

export const generateUniqueFolderName = async ({
  userId,
  parentFolder,
  name
}) => {
  let baseName = name?.trim() || "Untitled folder";
  let finalName = baseName;
  let counter = 1;

  while (
    await Folder.exists({
      userId,
      parentFolder,
      name: finalName
    })
  ) {
    finalName = `${baseName} (${counter})`;
    counter++;
  }

  return finalName;
};
