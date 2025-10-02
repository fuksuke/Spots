import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

const sanitizePathSegment = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, "");

export const uploadImageFile = async (file: File, category: "spots" | "comments" | "avatars") => {
  const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36);
  const extension = file.name.split(".").pop() ?? "img";
  const safeExtension = sanitizePathSegment(extension.toLowerCase()) || "img";
  const path = `${category}/${uniqueId}.${safeExtension}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type
  });

  return getDownloadURL(snapshot.ref);
};

export const uploadAvatarFile = async (file: File) => uploadImageFile(file, "avatars");
