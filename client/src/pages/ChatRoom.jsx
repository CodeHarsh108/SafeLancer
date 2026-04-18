import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import SimplePeer from 'simple-peer/simplepeer.min.js'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export default function ChatRoom() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = localStorage.getItem('token')

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [contract, setContract] = useState(null)

  // Video call state
  const [callState, setCallState] = useState('idle') // idle | calling | receiving | active
  const [caller, setCaller] = useState(null)
  const [callerSignal, setCallerSignal] = useState(null)

  const socketRef = useRef(null)
  const peerRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const typingTimerRef = useRef(null)
  const bottomRef = useRef(null)

  // Load contract info
  useEffect(() => {
    api.get(`/api/contracts/${contractId}`)
      .then(({ data }) => setContract(data.contract))
      .catch(() => {})
  }, [contractId])

  // Load messages
  useEffect(() => {
    api.get(`/api/messages/${contractId}`)
      .then(({ data }) => setMessages(data))
      .catch(() => {})
  }, [contractId])

  // Socket setup
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token } })
    socketRef.current = socket

    socket.emit('join-room', contractId)

    socket.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg])
    })

    socket.on('user-typing', () => {
      setOtherTyping(true)
    })

    socket.on('user-stop-typing', () => {
      setOtherTyping(false)
    })

    // Video call signals
    socket.on('incoming-call', ({ from, signal, name }) => {
      setCaller({ id: from, name })
      setCallerSignal(signal)
      setCallState('receiving')
    })

    socket.on('call-accepted', ({ signal }) => {
      peerRef.current?.signal(signal)
      setCallState('active')
    })

    socket.on('call-ended', () => {
      endCall(false)
    })

    return () => {
      socket.disconnect()
      endCall(false)
    }
  }, [contractId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!text.trim()) return
    socketRef.current?.emit('send-message', {
      contractId,
      text: text.trim(),
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
    })
    setText('')
    stopTyping()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTyping = (e) => {
    setText(e.target.value)
    if (!typing) {
      setTyping(true)
      socketRef.current?.emit('typing', { contractId, name: user.name })
    }
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(stopTyping, 1500)
  }

  const stopTyping = () => {
    setTyping(false)
    socketRef.current?.emit('stop-typing', { contractId })
    clearTimeout(typingTimerRef.current)
  }

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const peer = new SimplePeer({ initiator: true, trickle: false, stream })
      peerRef.current = peer

      peer.on('signal', (signal) => {
        socketRef.current?.emit('call-user', {
          contractId,
          signal,
          from: user.id,
          name: user.name,
        })
      })

      peer.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
      })

      peer.on('error', () => endCall(false))
      setCallState('calling')
    } catch {
      toast.error('Could not access camera/microphone')
    }
  }

  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const peer = new SimplePeer({ initiator: false, trickle: false, stream })
      peerRef.current = peer

      peer.on('signal', (signal) => {
        socketRef.current?.emit('accept-call', { contractId, signal })
      })

      peer.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
      })

      peer.on('error', () => endCall(false))
      peer.signal(callerSignal)
      setCallState('active')
    } catch {
      toast.error('Could not access camera/microphone')
    }
  }

  const endCall = (notify = true) => {
    if (notify) {
      socketRef.current?.emit('end-call', { contractId })
    }
    peerRef.current?.destroy()
    peerRef.current = null
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    setCallState('idle')
    setCaller(null)
    setCallerSignal(null)
  }

  const otherParty = contract
    ? (user.role === 'client' ? contract.freelancer?.name : contract.client?.name)
    : 'Other Party'

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      <Navbar />

      <div className="max-w-5xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors self-start">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

        {/* Video Call Panel */}
        {callState !== 'idle' && (
          <div className="bg-zinc-900 rounded-xl overflow-hidden">
            <div className="relative flex items-center justify-center" style={{ minHeight: 300 }}>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full max-h-80 object-cover rounded-lg" />
              <video ref={localVideoRef} autoPlay playsInline muted
                className="absolute bottom-3 right-3 w-32 h-24 object-cover rounded-lg border-2 border-white/20 shadow-lg" />
              {callState === 'active' && (
                <button onClick={() => endCall(true)}
                  className="absolute bottom-3 left-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  End Call
                </button>
              )}
            </div>
            {callState === 'calling' && (
              <div className="text-center p-4 text-zinc-400 text-sm">
                Calling {otherParty}...
                <button onClick={() => endCall(true)} className="ml-4 text-red-400 hover:text-red-300 underline">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Incoming Call */}
        {callState === 'receiving' && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-zinc-900">{caller?.name} is calling...</p>
              <p className="text-sm text-zinc-500">Incoming video call</p>
            </div>
            <div className="flex gap-2">
              <button onClick={acceptCall}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Accept
              </button>
              <button onClick={() => { setCallState('idle'); setCaller(null) }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Chat Box */}
        <div className="bg-white rounded-xl border border-zinc-200 flex flex-col flex-1" style={{ minHeight: 400 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div>
              <h2 className="font-semibold text-zinc-900 text-sm">Chat — {contract?.job?.title || 'Contract'}</h2>
              <p className="text-xs text-zinc-400">{otherParty}</p>
            </div>
            {callState === 'idle' && (
              <button onClick={startCall}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Video Call
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5" style={{ maxHeight: 450 }}>
            {messages.length === 0 && (
              <p className="text-center text-zinc-400 py-8 text-sm">No messages yet. Say hello!</p>
            )}
            {messages.map((msg, i) => {
              const isMine = String(msg.sender?._id || msg.sender || '') === user.id
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs md:max-w-md px-4 py-2.5 rounded-xl text-sm ${
                    isMine ? 'bg-zinc-900 text-white rounded-br-sm' : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
                  }`}>
                    {!isMine && <p className="text-xs font-semibold mb-1 text-zinc-500">{msg.sender?.name || msg.senderName}</p>}
                    <p className="leading-relaxed">{msg.text}</p>
                    <p className={`text-xs mt-1 ${isMine ? 'text-zinc-400' : 'text-zinc-400'}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                    </p>
                  </div>
                </div>
              )
            })}
            {otherTyping && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 rounded-xl rounded-bl-sm px-4 py-2.5 text-sm text-zinc-400 italic">
                  {otherParty} is typing...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-100 p-4 flex gap-3">
            <textarea
              value={text}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Type a message... (Enter to send)"
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-zinc-400 transition-colors"
            />
            <button onClick={sendMessage} disabled={!text.trim()}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
