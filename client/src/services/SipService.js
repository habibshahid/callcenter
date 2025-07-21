// src/services/SipService.js
import { 
  UserAgent, 
  Inviter,
  SessionState,
  Registerer
} from 'sip.js';

class SipService {
  constructor() {
    this.userAgent = null;
    this.registerer = null;
    this.config = null;
    this.statusListeners = new Set();
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.networkCheckInterval = null;
    this.activeSession = null;
    this.callListeners = new Set();
    this.iceServers = [{
      urls: 'stun:stun.l.google.com:19302'
    }];
  }

  addStatusListener(listener) {
    this.statusListeners.add(listener);
    listener(this.connectionState);
  }

  removeStatusListener(listener) {
    this.statusListeners.delete(listener);
  }

  updateStatus(status) {
    console.log('SIP Status Updated:', status);
    this.connectionState = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  async initialize(config) {
    console.log('Initializing SIP with config:', {
      webrtcGateway: config.webrtcGateway,
      sipUsername: config.sipUsername,
      sipDomain: config.sipDomain
    });
    this.config = config;
    await this.connect();
  }

  async connect() {
    try {
      this.updateStatus('connecting');

      const uri = UserAgent.makeURI(`sip:${this.config.sipUsername}@${this.config.sipDomain}`);
      
      if (!uri) {
        throw new Error('Failed to create URI');
      }

      const userAgentOptions = {
        uri,
        transportOptions: {
          server: this.config.webrtcGateway,
          connectionTimeout: 15,
          traceSip: true,
          wsServers: [this.config.webrtcGateway]
        },
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          },
          peerConnectionConfiguration: {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 0
          }
        },
        authorizationUsername: this.config.sipUsername,
        authorizationPassword: this.config.sipPassword,
        displayName: this.config.sipUsername,
        hackWssInTransport: true,
        hackViaTcp: true,
        hackIpInContact: true,
        hackStripTcp: true,
        contactName: this.config.sipUsername,
        userAgentString: 'Axon WebRTC (SIPJS 0.21.1)',
        register: true,
        delegate: {
          onInvite: async (invitation) => {
            console.log('Incoming INVITE received:', invitation);
            
            // Extract the calling number
            const remoteIdentity = invitation.remoteIdentity;
            const remoteNumber = remoteIdentity.uri.user;
            console.log('Call from:', remoteNumber);

            // Store session
            this.activeSession = invitation;

            let callerInfo = {
              number: remoteNumber,
              name: remoteIdentity.displayName || remoteNumber,
              isInbound: true
            };

            try {
              // Attempt to identify the caller from contacts
              const token = localStorage.getItem('token');
              const response = await fetch(`/api/contacts/lookup/${remoteNumber}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                const contact = await response.json();
                if (contact) {
                  callerInfo = {
                    ...callerInfo,
                    contactId: contact.id,
                    name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone,
                    company: contact.company,
                    email: contact.email,
                    campaign: contact.campaign_name,
                    status: contact.status,
                    customData: contact.custom_data
                  };
                  console.log('Caller identified:', callerInfo);
                }
              }
            } catch (error) {
              console.error('Error looking up caller:', error);
            }

            // Set up listeners for the incoming call
            this.setupIncomingCallListeners(invitation, remoteNumber);

            // Update UI status
            this.updateCallStatus('ringing', {
              number: remoteNumber,
              isInbound: true,
              callerName: remoteIdentity.displayName || remoteNumber
            });
          },
          // Add onMessage handler for debugging
          onMessage: (message) => {
            console.log('Received SIP message:', message);
          }
        }
      };
      
      console.log('Creating UserAgent with options:', {
        uri: uri.toString(),
        server: this.config.webrtcGateway
      });

      this.userAgent = new UserAgent(userAgentOptions);

      // Add transport event listeners
      this.userAgent.transport.onConnect = () => {
        console.log('Transport connected');
        this.updateStatus('connected');
        this.reconnectAttempts = 0;
      };

      this.userAgent.transport.onDisconnect = (error) => {
        console.log('Transport disconnected:', error);
        this.updateStatus('disconnected');
        this.handleDisconnect();
      };

      await this.userAgent.start();
      
      this.registerer = new Registerer(this.userAgent, {
        expires: 300
      });

      this.registerer.stateChange.addListener((state) => {
        console.log('Registration state:', state);
        switch (state) {
          case 'Registered':
            this.updateStatus('registered');
            break;
          case 'Unregistered':
            this.updateStatus('connected');
            break;
          case 'Terminated':
            this.updateStatus('disconnected');
            break;
        }
      });

      await this.registerer.register();
      console.log('SIP registration completed');

    } catch (error) {
      console.error('SIP connection error:', error);
      this.updateStatus('error');
      this.handleDisconnect();
    }
  }
  
  setupIncomingCallListeners(invitation, remoteNumber) {
    invitation.stateChange.addListener((state) => {
      console.log(`Incoming call state changed to: ${state}`);
      
      switch(state) {
        case SessionState.Terminated:
          this.activeSession = null;
          this.updateCallStatus('terminated', { 
            number: remoteNumber,
            isInbound: true 
          });
          break;
        
        case SessionState.Established:
          this.setupMediaHandling(invitation, remoteNumber);
          this.logCallStart(remoteNumber, 'inbound');
          break;
          
        default:
          this.updateCallStatus(state.toString().toLowerCase(), { 
            number: remoteNumber,
            isInbound: true 
          });
      }
    });

    // Add more detailed logging for debugging
    if (invitation.sessionDescriptionHandler) {
      invitation.sessionDescriptionHandler.peerConnection.addEventListener('icecandidate', (event) => {
        console.log('ICE candidate:', event.candidate);
      });

      invitation.sessionDescriptionHandler.peerConnection.addEventListener('connectionstatechange', (event) => {
        console.log('Connection state:', event.target.connectionState);
      });
    }
  }

  async logCallStart(phoneNumber, direction) {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/contacts-management/log-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: phoneNumber,
          direction,
          type: 'call_start',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error logging call start:', error);
    }
  }

  async logCallEnd(phoneNumber, direction) {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/contacts-management/log-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: phoneNumber,
          direction,
          type: 'call_end',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error logging call end:', error);
    }
  }
  
  modifySDPForChanSip(description) {
    let sdp = description.sdp;
    
    // Log the original SDP for debugging
    console.log('Original SDP:', sdp);
    
    // Keep the fingerprint line but update protocol if needed
    sdp = sdp.split('\n')
      .filter(line => {
        // Keep the fingerprint line
        if (line.includes('a=fingerprint:')) {
          console.log('Keeping fingerprint line:', line);
          return true;
        }
        // Keep all other lines
        return true;
      })
      .join('\n');
    
    // Log the modified SDP
    console.log('Modified SDP:', sdp);
    
    return new RTCSessionDescription({
      type: description.type,
      sdp: sdp
    });
  }
  
  async makeCall(number) {
    if (!this.userAgent || this.connectionState !== 'registered') {
      throw new Error('SIP not ready');
    }

    try {
      console.log('Making call to:', number);
      
      const target = UserAgent.makeURI(`sip:${number}@${this.config.sipDomain}`);
      
      if (!target) {
        throw new Error('Invalid number');
      }

      let contactInfo = { number, isInbound: false };
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/contacts-management/log-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            phone: number,
            direction: 'outbound',
            type: 'call'
          })
        });
        
        if (response.ok) {
          const contact = await response.json();
          if (contact && !contact.found === false) {
            contactInfo = {
              ...contactInfo,
              contactId: contact.id,
              name: contact.name || number,
              company: contact.company,
              campaign_id: contact.campaign_id,
              customData: contact.custom_data
            };
            console.log('Contact info for outbound call:', contactInfo);
          }
        }
      } catch (logError) {
        console.error('Error logging call:', logError);
        // Don't block the call if logging fails
      }
      
      const options = {
        earlyMedia: true,
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          },
          iceGatheringTimeout: 2000,
          peerConnectionConfiguration: {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 0,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            enableDtlsSrtp: true
          }
        },
        // Add the SDP modifier here
        sessionDescriptionHandlerModifiers: [
          (description) => this.modifySDPForChanSip(description)
        ]
      };

      const inviter = new Inviter(this.userAgent, target, options);
      
      // Add event listener for SDP handling in makeCall
      inviter.stateChange.addListener((state) => {
        console.log(`Call state changed to: ${state}`);
        this.updateCallStatus(state, { number });
        
        // Log SDP when available
        if (inviter.sessionDescriptionHandler) {
          const peerConnection = inviter.sessionDescriptionHandler.peerConnection;
          if (peerConnection) {
            console.log('Local description:', peerConnection.localDescription);
            console.log('Remote description:', peerConnection.remoteDescription);
          }
        }
      });

      // Setup event handlers for different response types
      const requestDelegate = {
        onAccept: (response) => {
          console.log('Call accepted:', response);
          console.log('Session state:', inviter.state);
          console.log('Session description handler:', inviter.sessionDescriptionHandler);
          
          // Wait a brief moment for the peer connection to be established
          setTimeout(() => {
            if (inviter.sessionDescriptionHandler) {
              this.setupMediaHandling(inviter, number);
            } else {
              console.error('No session description handler available after accept');
            }
          }, 500);
        },
        onProgress: (response) => {
          console.log('Call progress:', response.message.statusCode);
          if (response.message.statusCode === 183) {
            this.handleEarlyMedia(inviter, response);
          }
        },
        onRedirect: (response) => {
          console.log('Call redirected:', response);
        },
        onReject: (response) => {
          console.log('Call rejected:', response);
          this.updateCallStatus('rejected', { number });
        },
        onTrying: (response) => {
          console.log('Call trying:', response);
          this.updateCallStatus('trying', { number });
        }
      };
      
      // Store the active session
      this.activeSession = inviter;

      // Send the INVITE
      console.log('Sending INVITE...');
      await inviter.invite({
        requestDelegate,
        requestOptions: {
          extraHeaders: [
            'Allow: INVITE, ACK, CANCEL, BYE, REFER, INFO, NOTIFY, UPDATE',
            'Supported: replaces, 100rel'
          ]
        }
      });

      return inviter;
    } catch (error) {
      console.error('Error making call:', error);
      this.updateCallStatus('failed', { number });
      throw error;
    }
  }

  async endCall() {
    try {
      if (!this.activeSession) {
        throw new Error('No active call to end');
      }

      switch (this.activeSession.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          await this.activeSession.cancel();
          break;
        case SessionState.Established:
          await this.activeSession.bye();
          break;
        default:
          console.log('Call already terminated or in invalid state');
      }

      this.activeSession = null;
      this.updateCallStatus('terminated');
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  async holdCall(shouldHold) {
    try {
      if (!this.activeSession || !this.activeSession.sessionDescriptionHandler) {
        throw new Error('No active session to hold');
      }

      const sessionDescriptionHandler = this.activeSession.sessionDescriptionHandler;
      const peerConnection = sessionDescriptionHandler.peerConnection;

      if (!peerConnection) {
        throw new Error('No peer connection available');
      }

      // Get all audio senders
      const audioSenders = peerConnection.getSenders().filter(sender => 
        sender.track && sender.track.kind === 'audio'
      );

      // Set the direction of audio tracks
      audioSenders.forEach(sender => {
        if (sender.track) {
          sender.track.enabled = !shouldHold;
        }
      });

      // Keep the session state as 'active' but update hold status
      this.updateCallStatus('active', { 
        isHeld: shouldHold,
        isMuted: this.activeSession.isMuted || false,
        number: this.activeSession.remoteIdentity.uri.user 
      });
    } catch (error) {
      console.error('Error in hold/unhold:', error);
      throw error;
    }
  }

  async muteCall(shouldMute) {
    try {
      if (!this.activeSession || !this.activeSession.sessionDescriptionHandler) {
        throw new Error('No active session to mute');
      }

      const peerConnection = this.activeSession.sessionDescriptionHandler.peerConnection;
      if (!peerConnection) {
        throw new Error('No peer connection available');
      }

      const audioSenders = peerConnection.getSenders().filter(sender => 
        sender.track && sender.track.kind === 'audio'
      );

      audioSenders.forEach(sender => {
        if (sender.track) {
          sender.track.enabled = !shouldMute;
        }
      });

      // Keep the session state as 'active' but update mute status
      this.updateCallStatus('active', { 
        isMuted: shouldMute,
        isHeld: this.activeSession.isHeld || false,
        number: this.activeSession.remoteIdentity.uri.user 
      });

      // Store mute state on the session
      this.activeSession.isMuted = shouldMute;
    } catch (error) {
      console.error('Error in mute/unmute:', error);
      throw error;
    }
  }

  updateCallStatus(status, details = {}) {
    // Preserve existing call state when updating
    const currentState = this.activeSession ? {
      isHeld: this.activeSession.isHeld || false,
      isMuted: this.activeSession.isMuted || false,
      number: this.activeSession.remoteIdentity?.uri.user
    } : {};

    // Merge current state with new details
    const updatedDetails = {
      ...currentState,
      ...details,
      status
    };

    console.log('Updating call status:', updatedDetails);
    this.callListeners.forEach(listener => listener(updatedDetails));
  }
  
  handleEarlyMedia(session, response) {
    try {
      const sdp = response.message.body;
      console.log('Handling early media, Original SDP:', sdp);
      
      if (sdp && session.sessionDescriptionHandler) {
        // Don't modify the SDP, keep the fingerprint
        session.sessionDescriptionHandler
          .setDescription({ type: 'answer', sdp })
          .then(() => {
            console.log('Early media description set successfully');
          })
          .catch(error => {
            console.error('Error setting early media:', error);
            this.updateCallStatus('trying', { number: session.number });
          });
      }
    } catch (error) {
      console.error('Error in early media handling:', error);
    }
  }

  setupMediaHandling(session, number) {
    try {
      console.log('Setup media called with session:', session);
      console.log('Session state:', session.state);
      console.log('Has session description handler:', !!session.sessionDescriptionHandler);

      if (!session || !session.sessionDescriptionHandler) {
        console.error('Waiting for session description handler...');
        return;
      }

      // Wait for peer connection to be ready
      const waitForPeerConnection = () => {
        const peerConnection = session.sessionDescriptionHandler.peerConnection;
        
        if (!peerConnection) {
          console.log('Waiting for peer connection...');
          setTimeout(waitForPeerConnection, 100);
          return;
        }

        console.log('Peer connection ready, state:', peerConnection.connectionState);

        peerConnection.addEventListener('track', (event) => {
          console.log('Track received:', event);
          if (event.track.kind === 'audio') {
            const audioElement = new Audio();
            audioElement.srcObject = new MediaStream([event.track]);
            audioElement.play().catch(console.error);
          }
        });

        // Update call status
        this.updateCallStatus('active', { number });
      };

      waitForPeerConnection();
    } catch (error) {
      console.error('Error in media setup:', error);
    }
  }

  async answerCall() {
    try {
      if (!this.activeSession) {
        throw new Error('No active call to answer');
      }

      await this.activeSession.accept();
      await this.setupMediaHandling(this.activeSession, this.activeSession.remoteIdentity.uri.user);
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }

  async rejectCall() {
    try {
      if (!this.activeSession) {
        throw new Error('No active call to reject');
      }

      await this.activeSession.reject();
      this.activeSession = null;
      this.updateCallStatus('terminated');
    } catch (error) {
      console.error('Error rejecting call:', error);
      throw error;
    }
  }

  addCallListener(listener) {
    this.callListeners.add(listener);
  }

  removeCallListener(listener) {
    this.callListeners.delete(listener);
  }

  handleDisconnect() {
    // Only attempt reconnect if still logged in
    if (!this.isLoggedIn()) {
      console.log('Not logged in, skipping reconnection');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000 * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.updateStatus('error');
    }
  }
  
  async cleanupConnection() {
    console.log('Starting complete SIP cleanup...');

    try {
      // End any active calls first
      if (this.activeSession) {
        try {
          console.log('Ending active call...');
          await this.endCall();
        } catch (error) {
          console.error('Error ending active call:', error);
        }
      }

      // Unregister from SIP server
      if (this.registerer) {
        try {
          console.log('Unregistering SIP...');
          await this.registerer.unregister();
          this.registerer = null;
        } catch (error) {
          console.error('Error unregistering SIP:', error);
        }
      }

      // Stop UserAgent
      if (this.userAgent) {
        try {
          console.log('Stopping user agent...');
          await this.userAgent.stop();
          await this.userAgent.transport.disconnect();
          this.userAgent = null;
        } catch (error) {
          console.error('Error stopping user agent:', error);
        }
      }

      // Clear all listeners and states
      this.statusListeners.clear();
      this.callListeners.clear();
      this.activeSession = null;
      this.connectionState = 'disconnected';
      this.reconnectAttempts = 0;
      this.config = null;

      // Clear any pending timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.updateStatus('disconnected');
      console.log('SIP cleanup completed');

    } catch (error) {
      console.error('Error during SIP cleanup:', error);
      throw error;
    }
  }
  
  isLoggedIn() {
    return !!localStorage.getItem('token');
  }

}

const sipService = new SipService();
export default sipService;