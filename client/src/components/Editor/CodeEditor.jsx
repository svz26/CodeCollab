import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { socket } from "../../socket/socket";

// Optional: accept roomId as prop so the editor knows which room to sync within
const CodeEditor = ({ roomId }) => {
  const [code, setCode] = useState("// Start collaborating in CodeCollab\n");
  const isRemoteUpdate = useRef(false);

  const handleChange = (value) => {
    const newValue = value ?? "";
    setCode(newValue);

    // Don't echo updates that came from the socket
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (!roomId) return;

    socket.emit("code-change", { roomId, code: newValue });
  };

  useEffect(() => {
    if (!roomId) return;

    const handleCodeChange = ({ roomId: incomingRoomId, code: incomingCode }) => {
      if (!incomingRoomId || incomingRoomId !== roomId) return;

      isRemoteUpdate.current = true;
      setCode(incomingCode ?? "");
    };

    socket.on("code-change", handleCodeChange);

    return () => {
      socket.off("code-change", handleCodeChange);
    };
  }, [roomId]);

  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={code}
        onChange={handleChange}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
        }}
      />
    </div>
  );
};

export default CodeEditor;


