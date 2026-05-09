import API_BASE from "../config";
import React, { useState, useRef, useEffect } from "react";
import { Plus, Folder, Upload } from "lucide-react";
import "./Dashboard.css";
import Logo from "../assets/airbox-logo.png";
import { io } from "socket.io-client";

const socket = io(API_BASE, {
  autoConnect: false,
});

export default function Dashboard() {
  const fileInputRef = useRef(null);
  const [userPlan, setUserPlan] = useState(null);
  const [userStorageLimit, setUserStorageLimit] = useState(null);

  /* ---------------- STATE ---------------- */
  const [view, setView] = useState("home");
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [tempName, setTempName] = useState("");
  const [activeFolder, setActiveFolder] = useState(null);
  const [draggedFile, setDraggedFile] = useState(null);
  const [fileMenu, setFileMenu] = useState(null);
  const [activeFileId, setActiveFileId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFileId, setEditingFileId] = useState(null);
  const [tempFileName, setTempFileName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Convert bytes to GB (2 decimal places)
  const bytesToGB = (bytes) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
  };

  const normalizeFile = (file) => ({
    ...file,
    id: file._id,
    url: `${API_BASE}/${file.path}`,
  });

  /* ---------------- STORAGE ---------------- */
  const usedBytes = files.reduce(
    (sum, f) => sum + (Number(f.size) || 0),
    0
  );

  const usagePercent = userStorageLimit
    ? Math.min((usedBytes / userStorageLimit) * 100, 100)
    : 0;

  const isStorageFull = userStorageLimit
    ? usedBytes >= userStorageLimit
    : false;

  const freeBytes =
  userStorageLimit != null
    ? Math.max(userStorageLimit - usedBytes, 0)
    : 0;

  const isAlmostFull = usagePercent >= 90 && !isStorageFull;


  /*----- db to dashboard data------*/
  const refreshFiles = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const folderRes = await fetch(`${API_BASE}/api/folders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const fileRes = await fetch(`${API_BASE}/api/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const foldersData = await folderRes.json();
      const filesData = await fileRes.json();

      setFolders(foldersData);
      setFiles(filesData.map(normalizeFile));
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("User fetch failed:", data.message);
        return;
      }

      console.log("User info loaded:", data);

      setUserPlan(data.plan);
      setUserStorageLimit(data.storageLimit);
    } catch (err) {
      console.error("Fetch user error:", err);
    }
  };

  useEffect(() => {
    refreshFiles();
    fetchUserInfo();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    socket.disconnect();
    socket.off();

    const payload = JSON.parse(atob(token.split(".")[1]));

    socket.auth = { token };
    socket.connect();

    socket.on("connect", () => {
      socket.emit("join-user", payload.id);
    });

    socket.on("user-plan-updated", (data) => {
      setUserPlan(prev => {
        if (prev === data.plan) return prev;
        return data.plan;
      });

      setUserStorageLimit(prev => {
        if (prev === data.storageLimit) return prev;
        return data.storageLimit;
      });
    });

    socket.on("user-files-updated", refreshFiles);
    socket.on("user-storage-updated", refreshFiles);

    return () => {
      socket.off();
      socket.disconnect();
    };
  }, []);

  /* ---------------- FILE LOGIC ---------------- */

  const detectCategory = (file) => {
    if (file.type.startsWith("image")) return "image";
    if (file.type.startsWith("video")) return "video";
    if (
      file.type.includes("pdf") ||
      file.type.includes("word") ||
      file.type.includes("excel") ||
      file.type.includes("presentation") ||
      file.type.includes("text")
    )
      return "doc";
    return "other";
  };

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const token = localStorage.getItem("token");

    const selectedBytes = selectedFiles.reduce(
      (sum, f) => sum + f.size,
      0
    );

    // 🔒 FRONTEND QUOTA CHECK
    if (!userStorageLimit) {
      alert("Storage info not loaded yet");
      return;
    }

    if (usedBytes + selectedBytes > userStorageLimit) {
      alert(
        `Upload blocked: storage limit exceeded (${bytesToGB(userStorageLimit)} GB)`
      );
      fileInputRef.current.value = "";
      return;
    }

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", detectCategory(file));
        formData.append("folderId", activeFolder?._id || "");

        const res = await fetch(`${API_BASE}/api/files/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.message || "Upload failed");
          break;
        }

        const saved = await res.json();
        setFiles(prev => [...prev, normalizeFile(saved)]);

      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    fileInputRef.current.value = "";
  };

  const handleRestore = async (file) => {
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${API_BASE}/api/files/${file._id}/restore`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error(err.message);
      return;
    }

    const restoredFile = await res.json();
    setFiles(prev =>
      prev.map(f =>
        f._id === restoredFile._id
          ? normalizeFile(restoredFile)
          : f
      )
    );
    setActiveFileId(null);
  };

  const startFileRename = (file) => {
    setEditingFileId(file.id);
    setTempFileName(file.name);
    setActiveFileId(null);
  };

  const confirmFileRename = async (file) => {
    if (!tempFileName.trim()) {
      setEditingFileId(null);
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_BASE}/api/files/${file.id}/rename`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: tempFileName }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Rename failed");
      }

      const updatedFile = await res.json();

      setFiles(prev =>
        prev.map(f =>
          f.id === updatedFile._id ? { ...f, name: updatedFile.name } : f
        )
      );
      setEditingFileId(null);
      setTempFileName("");
    } catch (err) {
      alert(err.message);
      setEditingFileId(null);
    }
  };

  /* ---------------- FOLDER ACTIONS ---------------- */
  const createFolder = async () => {
    if (!folderName.trim()) return;

    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/api/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // 🔥 FIX
      },
      body: JSON.stringify({
        name: folderName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to create folder");
      return;
    }

    setFolders((prev) => [...prev, data]); // only add if success

    setFolderName("");
    setShowModal(false);
  };

  const startRename = (folderId) => {
    const folder = folders.find(f => f._id === folderId);
    if (!folder) return;

    setEditingFolderId(folder._id);
    setTempName(folder.name);
    setContextMenu(null);
  };

  const confirmRename = async (folderId) => {
    if (!tempName.trim()) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_BASE}/api/folders/${folderId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: tempName }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Rename failed");
      }

      const updatedFolder = await res.json();

      // ✅ update state ONLY after DB success
      setFolders((prev) =>
        prev.map((f) =>
          f._id === updatedFolder._id ? updatedFolder : f
        )
      );

      setEditingFolderId(null);
      setTempName("");
    } catch (err) {
      alert(err.message);
      setEditingFolderId(null);
    }
  };

  const deleteFolder = async (folderId) => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/api/folders/${folderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to delete folder");

      // ✅ Remove folder from UI only after backend success
      setFolders(prev => prev.filter(f => f._id !== folderId));

      // 🔥 Remove files inside that folder from UI
      setFiles(prev => prev.filter(file => file.folderId !== folderId));

      // Reset active folder if needed
      if (activeFolder?._id === folderId) setActiveFolder(null);

      setContextMenu(null);

      alert(data.message); // optional success alert
    } catch (err) {
      console.error("Delete folder error:",   err);
      alert(err.message);
    }
  };

  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleUpgrade = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/api/user/upgrade`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Upgrade failed");
      return;
    }

    // Socket will sync plan
    alert(data.message);
    setShowUpgrade(false);
  };

  /* ---------------- SIGN OUT ---------------- */

  const signOut = () => {
     socket.off();
    socket.disconnect();
    socket.auth = null;
    
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  /* ---------------- FILTER ---------------- */
  const filteredFiles = files.filter((file) => {
    if (view === "trash") return file.isTrashed;
    if (file.isTrashed) return false;

    if (activeFolder && file.folderId !== activeFolder._id) return false;
    if (!activeFolder && view !== "home" && file.category !== view) return false;
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;

    return true;
  });

  const isImage = (file) => file.category === "image";
  const isVideo = (file) => file.category === "video";
  
  const longPressTimeout = useRef(null);
  const handleLongPress = (e, callback) => {
    if (window.innerWidth <= 768) {
      e.stopPropagation();   // 🔥 prevent dashboard click
      longPressTimeout.current = setTimeout(() => {
        callback();
      }, 500);
    }
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimeout.current);
  };

  return (
    <div
      className="dashboard"
      onClick={(e) => {
        // Prevent closing menu when clicking inside file card (mobile only)
        if (window.innerWidth <= 768 && e.target.closest(".file-card")) return;

        if (mobileMenuOpen) setMobileMenuOpen(false);
        setContextMenu(null);
        setFileMenu(null);
        setActiveFileId(null);
      }}
    >

      {/* SIDEBAR */}
      <div className="mobile-header">
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(prev => !prev)}
        >
          ☰
        </button>
        <img src={Logo} alt="AirBox" className="mobile-logo" />
      </div>

      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="logo">
          <img src={Logo} alt="AirBox" />
        </div>

        <nav className="nav">
          <div
            className={`nav-item ${view === "home" && !activeFolder && "active"}`}
            onClick={() => {
              setActiveFolder(null);
              setView("home");
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async () => {
              if (!draggedFile) return;

              const token = localStorage.getItem("token");

              const res = await fetch(
                `${API_BASE}/api/files/${draggedFile.id}/move`,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ folderId: null }), // 🔥 BACK TO HOME
                }
              );

              if (!res.ok) {
                alert("Failed to move file to Home");
                return;
              }

              setFiles((prev) =>
                prev.map((f) =>
                  f.id === draggedFile.id ? { ...f, folderId: null } : f
                )
              );

              setDraggedFile(null);
              setActiveFolder(null);
              setView("home");
            }}
          >
            Home
          </div>
          <div
            className={`nav-item ${isStorageFull ? "disabled" : ""}`}
            onClick={() => {
              if (!isStorageFull) fileInputRef.current.click();
            }}
          >
            <Upload size={16} /> Upload
          </div>
          <div className="nav-item" onClick={() => setView("image")}>Your Images</div>
          <div className="nav-item" onClick={() => setView("doc")}>Your Docs</div>
          <div className="nav-item" onClick={() => setView("video")}>Your Videos</div>
          <div className="nav-item" onClick={() => setView("trash")}>Trash</div>
          <div className="nav-item logout" onClick={signOut}>Sign Out</div>
          {userPlan === "free" && (
            <div className="upgrade-section">
              <button
                className="upgrade-btn"
                onClick={() => setShowUpgrade(true)}
              >
                ⭐ Upgrade to Pro
              </button>
              <p className="upgrade-text">Get 50GB storage</p>
            </div>
          )}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="header">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Folder
          </button>
        </div>

        {/* STORAGE */}
        {isStorageFull && (
          <div className="storage-warning error">
            🚫 Storage full! You’ve reached your {bytesToGB(userStorageLimit)} GB limit.
          </div>
        )}

        {isAlmostFull && (
          <div className="storage-warning warn">
            ⚠️ You are almost out of storage.
          </div>
        )}

        <div className="card">
          <h2>Storage Usage</h2>

          <div className="storage-bar">
            <div
              className="used"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          
          <div className="storage-info">
            <span>Used: {bytesToGB(usedBytes)} GB</span>
            <span>Free: {bytesToGB(freeBytes)} GB</span>
            <span>
              Total: {userStorageLimit ? bytesToGB(userStorageLimit) : "—"} GB
            </span>
          </div>
        </div>
        {activeFolder && (
          <div className="breadcrumb">
            <span onClick={() => setActiveFolder(null)}>Home</span> / {activeFolder?.name || "Folder"}
          </div>
        )}

        {/* FOLDERS */}
          <div className="card">
            <h2>Your Folders</h2>

            {folders.length === 0 ? (
              <p className="empty">No folders created</p>
            ) : (
              <div className="folder-grid">
                {folders.map(folder => (
                  <div
                    data-id={folder._id}
                    key={folder._id}
                    className="folder-card"
                    onDoubleClick={() => setActiveFolder(folder)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async () => {
                      if (!draggedFile) return;

                      const token = localStorage.getItem("token");

                      const res = await fetch(
                        `${API_BASE}/api/files/${draggedFile.id}/move`,
                        {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ folderId: folder._id }),
                        }
                      );

                      if (!res.ok) {
                        alert("Failed to move file");
                        return;
                      }

                      setFiles((prev) =>
                        prev.map((f) =>
                          f.id === draggedFile.id
                            ? { ...f, folderId: folder._id }
                            : f
                        )
                      );

                        setDraggedFile(null);
                      }}

                    onContextMenu={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({
                        folderId: folder._id,
                        top: rect.top + window.scrollY + 10,
                        left: rect.right - 90
                      });
                    }}

                    onTouchStart={(e) =>
                      handleLongPress(e, () => {
                        const rect = document
                          .querySelector(`[data-id='${folder._id}']`)
                          ?.getBoundingClientRect();

                        setContextMenu({
                          folderId: folder._id,
                          top: rect?.top + window.scrollY + 10,
                          left: rect?.right - 100,
                        });
                      })
                    }
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >

                    <div className="folder-content">
                      <Folder size={22} />

                      {editingFolderId === folder._id ? (
                        <input
                          className="rename-input"
                          value={tempName}
                          autoFocus
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={() => confirmRename(folder._id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename(folder._id);
                            if (e.key === "Escape") setEditingFolderId(null);
                          }}
                        />
                      ) : (
                        <span>{folder.name || "Untitled Folder"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* FILES */}
        <div className="card">
          <h2>Your Files</h2>
          {filteredFiles.length === 0 ? (
            <p className="empty">No files to display</p>
          ) : (
            <div className="file-grid">
              {filteredFiles.map(file => (
                <div
                  key={file._id}
                  className="file-card"
                  draggable
                  onDragStart={() => setDraggedFile(file)}
                  onDragEnd={() => setDraggedFile(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveFileId(file.id);
                  }}
                  onTouchStart={(e) =>
                    handleLongPress(e, () => {
                      setActiveFileId(file.id);
                    })
                  }
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                >
                  <div className="file-preview">
                    {file.category === "image" ? (
                      <img src={file.url} alt={file.name} />
                    ) : file.category === "video" ? (
                      <video src={file.url} />
                    ) : (
                      <div className="file-icon">📄</div>
                    )}
                  </div>

                  <div className="file-name">
                    {editingFileId === file.id ? (
                      <input
                        className="rename-input"
                        value={tempFileName}
                        autoFocus
                        onChange={(e) => setTempFileName(e.target.value)}
                        onBlur={() => confirmFileRename(file)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmFileRename(file);
                          if (e.key === "Escape") setEditingFileId(null);
                        }}
                      />
                    ) : (
                      <span>{file.name}</span>
                    )}
                  </div>

                  {activeFileId === file.id && (
                    <div
                      className="file-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {view === "trash" ? (
                        /* ================= TRASH VIEW ================= */
                        <>
                          <button onClick={() => handleRestore(file)}>
                            ♻ Restore
                          </button>

                          <button
                            onClick={async () => {
                              const token = localStorage.getItem("token");

                              await fetch(
                                `${API_BASE}/api/files/${file.id}/permanent`,
                                {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );

                              setFiles(prev => prev.filter(f => f.id !== file.id));
                              setActiveFileId(null);
                            }}
                          >
                            ❌ Delete Forever
                          </button>
                        </>
                      ) : (
                        /* ================= NORMAL VIEW ================= */
                        <>
                          <button
                            onClick={async () => {
                              const token = localStorage.getItem("token");

                              const res = await fetch(
                                `${API_BASE}/api/files/${file.id}/download`,
                                {
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );

                              if (!res.ok) {
                                alert("Download failed");
                                return;
                              }

                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);

                              const a = document.createElement("a");
                              a.href = url;
                              a.download = file.name;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();

                              window.URL.revokeObjectURL(url);
                              setActiveFileId(null);
                            }}
                          >
                            ⬇ Download
                          </button>

                          <button
                            onClick={async () => {
                              const token = localStorage.getItem("token");

                              await fetch(
                                `${API_BASE}/api/files/${file.id}`,
                                {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );

                              setFiles(prev =>
                                prev.map(f =>
                                  f.id === file.id ? { ...f, isTrashed: true } : f
                                )
                              );

                              setActiveFileId(null);
                            }}
                          >
                            🗑 Delete
                          </button>

                          <button onClick={() => startFileRename(file)}>
                            ✏ Rename
                          </button>
                        </>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* UPLOAD INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleUpload}
      />

      {/* MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Create Folder</h3>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
            />
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary" onClick={createFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="folder-context-menu"
          style={{
            top: contextMenu.top,
            left: contextMenu.left
          }}
        >  
          <div onClick={() => startRename(contextMenu.folderId)}>Rename</div>
          <div onClick={() => deleteFolder(contextMenu.folderId)}>Delete</div>
        </div>
      )}

      {showUpgrade && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Upgrade to Pro</h3>
            <p>Get 50GB storage for ₹100</p>
            <input placeholder="Card Number" />
            <input placeholder="Expiry MM/YY" />
            <input placeholder="CVV" />
            <div className="modal-actions">
              <button onClick={() => setShowUpgrade(false)}>Cancel</button>
              <button className="primary" onClick={handleUpgrade}>Pay & Upgrade</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
