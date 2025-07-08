// utils/ami.js
const AsteriskManager = require('asterisk-manager');
require('dotenv').config();

class AMIService {
  constructor() {
    console.log('Initializing AMI with config:', {
      port: process.env.AMI_PORT,
      host: process.env.AMI_HOST,
      username: process.env.AMI_USERNAME,
    });

    this.ami = new AsteriskManager(
      parseInt(process.env.AMI_PORT) || 5038,
      process.env.AMI_HOST || 'localhost',
      process.env.AMI_USERNAME,
      process.env.AMI_PASSWORD,
      true
    );

    this.setupListeners();
  }

  setupListeners() {
    this.ami.on('connect', () => {
      console.log('Connected to Asterisk AMI');
    });

    this.ami.on('error', (err) => {
      console.error('AMI Error:', err);
    });

    this.ami.on('disconnect', () => {
      console.error('Disconnected from AMI');
    });
  }

  async addQueueMember(queue, interfaceName, memberName, penalty = 0) {
    console.log('Adding queue member:', {
      queue,
      interface: interfaceName,
      memberName,
      penalty
    });

    return new Promise((resolve, reject) => {
      this.ami.action({
        Action: 'QueueAdd',
        Queue: queue,
        Interface: interfaceName,
        MemberName: memberName,
        Penalty: penalty,
        StateInterface: interfaceName
      }, (err, res) => {
        if (err) {
          console.error('AMI QueueAdd Error:', err);
          reject(err);
        } else if (res.response === 'Error' && res.message.includes('Already there')) {
          // If member already exists, consider it a success
          console.log('Member already in queue, continuing...');
          resolve(res);
        } else if (res.response === 'Error') {
          console.error('AMI QueueAdd Error:', res);
          reject(new Error(res.message));
        } else {
          console.log('AMI QueueAdd Response:', res);
          resolve(res);
        }
      });
    });
  }

  async pauseQueueMember(queue, interfaceName, paused, reason = '') {
    return new Promise((resolve, reject) => {
      console.log({
        Action: 'QueuePause',
        Queue: queue,
        Interface: interfaceName,
        Paused: paused ? 'true' : 'false',
        Reason: reason
      })
      this.ami.action({
        Action: 'QueuePause',
        Queue: queue,
        Interface: interfaceName,
        Paused: paused ? 'true' : 'false',
        Reason: reason
      }, (err, res) => {
        if (err) {
          console.error('AMI QueuePause Error:', err);
          reject(err);
        } else {
          console.log('AMI QueuePause Response:', res);
          resolve(res);
        }
      });
    });
  }
  
  async action(actionData) {
    return new Promise((resolve, reject) => {
      this.ami.action(actionData, (err, res) => {
        if (err) {
          console.error('AMI Action Error:', {
            action: actionData.Action,
            error: err
          });
          reject(err);
        } else {
          console.log('AMI Action Response:', {
            action: actionData.Action,
            response: res
          });
          resolve(res);
        }
      });
    });
  }

  async removeQueueMember(queue, interfaceName) {
    return this.action({
      Action: 'QueueRemove',
      Queue: queue,
      Interface: interfaceName
    });
  }

  isConnected() {
    return this.ami.connected();
  }

  async testConnection() {
    return new Promise((resolve, reject) => {
      this.ami.action({
        Action: 'Ping'
      }, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }
}

const amiService = new AMIService();
module.exports = amiService;