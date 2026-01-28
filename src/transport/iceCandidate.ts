// ICE 功能说明（基于 MDN icecandidate 事件）
// 1) 当本地设置了 SDP 后，开始收集候选；每个候选会触发 icecandidate 事件。
// 2) event.candidate 有值时：需要通过信令发送给对端。
// 3) event.candidate 为空字符串 ""：表示该轮候选结束，也应发送给对端。
// 4) event.candidate 为 null：表示 ICE 收集完成（兼容性用途，不需要转发）。

export const attachIceHandlers = (
  pc: RTCPeerConnection,
  send: (candidate: RTCIceCandidate) => void,
) => {
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      send(event.candidate);
    }
  });
};

export const addRemoteIceCandidate = async (
  pc: RTCPeerConnection,
  candidate: RTCIceCandidate,
) => {
  try {
    await pc.addIceCandidate(candidate);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Error adding received ice candidate", e);
  }
};


// This example assumes that the other peer is using a signaling channel as follows:
//
// pc.onicecandidate = (event) => {
//   if (event.candidate) {
//     signalingChannel.send(JSON.stringify({ice: event.candidate})); // "ice" is arbitrary
//   } else {
//     // All ICE candidates have been sent
//   }
// }

// signalingChannel.onmessage = (receivedString) => {
//   const message = JSON.parse(receivedString);
//   if (message.ice) {
//     // A typical value of ice here might look something like this:
//     //
//     // {candidate: "candidate:0 1 UDP 2122154243 192.0.2.43 53421 typ host", sdpMid: "0", …}
//     //
//     // Pass the whole thing to addIceCandidate:
//
//     pc.addIceCandidate(message.ice).catch((e) => {
//       console.log(`Failure during addIceCandidate(): ${e.name}`);
//     });
//   } else {
//     // handle other things you might be signaling, like sdp
//   }
// };

// pc.addIceCandidate({ candidate: '' });
