import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { socket } from "../../socket/socket";

// This component expects to be given the current roomId and (optionally)
// a targetSocketId for the other participant. Wiring of targetSocketId discovery
// (e.g. via a "user-joined" event) can be done in the Room page later.
const VideoCall = ({ roomId, targetSocketId }) => {
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId) return;

    const user = localStorage.getItem("user");
    const parsedUser = user ? JSON.parse(user) : null;
    const userId = parsedUser?.id;

    // Join the room on the signaling server
    socket.emit("join-room", { roomId, userId });

    const setupMediaAndPeer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }

        // Don't create a peer until we know who we're connecting to
        // (targetSocketId). That wiring can be added later.
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setError("Could not access camera/microphone.");
      }
    };

    setupMediaAndPeer();

    const handleReceivingSignal = ({ from, signal }) => {
      // If we don't yet have a peer, create one as the non-initiator
      if (!peerRef.current && streamRef.current) {
        const peer = new Peer({
          initiator: false,
          trickle: false,
          stream: streamRef.current,
        });

        peer.on("signal", (answerSignal) => {
          // Send our answer back to the caller
          socket.emit("receiving-signal", {
            targetSocketId: from,
            signal: answerSignal,
          });
        });

        peer.on("stream", (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        peerRef.current = peer;
      }

      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    };

    socket.on("receiving-signal", handleReceivingSignal);

    return () => {
      socket.off("receiving-signal", handleReceivingSignal);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [roomId]);

  // When we know who to call, create the initiator peer and send offer
  useEffect(() => {
    if (!roomId || !targetSocketId || !streamRef.current) return;

    if (peerRef.current) return; // already connected or connecting

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: streamRef.current,
    });

    peer.on("signal", (offerSignal) => {
      socket.emit("sending-signal", {
        targetSocketId,
        signal: offerSignal,
      });
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setError("Connection error in video call.");
    });

    peerRef.current = peer;
  }, [roomId, targetSocketId]);

  return (
    <div className="w-full h-full bg-slate-800 text-slate-100 flex flex-col md:flex-row gap-4 p-4">
      {error && (
        <p className="w-full text-sm text-red-400 bg-red-900/40 px-3 py-2 rounded">
          {error}
        </p>
      )}
      <div className="flex-1 flex flex-col items-center">
        <h2 className="mb-2 text-sm font-semibold">My Video</h2>
        <video
          ref={myVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded bg-black"
        />
      </div>
      <div className="flex-1 flex flex-col items-center">
        <h2 className="mb-2 text-sm font-semibold">Remote Video</h2>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full rounded bg-black"
        />
      </div>
    </div>
  );
};

export default VideoCall;


