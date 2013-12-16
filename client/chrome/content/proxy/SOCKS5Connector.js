// Copyright (c) 2011 Moxie Marlinspike <moxie@thoughtcrime.org>
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307
// USA


/**
  * This class is responsible for building a tunnel through an external
  * SOCKS5 proxy.
  *
  **/

function SOCKS5Connector(proxy) {
  this.base = BaseProxyConnector;
  this.base(proxy);
}

SOCKS5Connector.prototype.sendClientHello = function(proxySocket) {
  var clientHello = [String.fromCharCode(0x05), String.fromCharCode(0x01), String.fromCharCode(0x00)];
  proxySocket.writeBytes(NSPR.lib.buffer(clientHello.join('')), 3);
};

SOCKS5Connector.prototype.readServerHello = function(proxySocket) {
  //var serverHello = proxySocket.readFully(2); // biolizard89 hack
  var serverHello = proxySocket.readBuffer(2);

  // biolizard89 test
  if (serverHello[0] != 0x05) {
    proxySocket.close();
    throw 'Not SOCKSv5';
  }

  if (serverHello[1] == 0xFF) {
    proxySocket.close();
    throw 'Server requires authentication, which we dont support!';
  }
};

SOCKS5Connector.prototype.sendConnectRequest = function(proxySocket, host, port) {
  CV9BLog.worker('Sending connect request for: ' + host + ':' + port);
  var request = [
    String.fromCharCode(0x05), String.fromCharCode(0x01),
    String.fromCharCode(0x00), String.fromCharCode(0x03),
    String.fromCharCode(host.length) ];

  var status = proxySocket.writeBytes(NSPR.lib.buffer(request.join('')), 5);
  var status = proxySocket.writeBytes(NSPR.lib.buffer(host), host.length);
  var portBytes = [ctypes.unsigned_char((port >> 8) & 0xFF), ctypes.unsigned_char(port & 0xFF)];
  var status = proxySocket.writeBytes(NSPR.lib.unsigned_buffer(portBytes), 2);
};

SOCKS5Connector.prototype.readConnectResponse = function(proxySocket, host) {
  //var response = proxySocket.readFully(4);
  var response = proxySocket.readBuffer(4);

  CV9BLog.worker('Got response: ' + response[1]);

  if (response[1] != 0x00) {
    proxySocket.close();
    throw 'SOCKS Proxy denied connection request (' + response[1] + ')!';
  }

  if (response[3] == 0x01) {
    proxySocket.readBuffer(6);
  } else if (response[3] == 0x04) {
    proxySocket.readBuffer(18);
  } else if (response[3] == 0x03) {
    var domainLength = proxySocket.readBuffer(1);
    domainLength = ctypes.cast(domainLength[0], ctypes.int32_t);
    proxySocket.readBuffer(domainLength+2);
  } else {
    proxySocket.close();
    throw 'Unknown address type in socks connect response.';
  }
};

SOCKS5Connector.prototype.makeConnection = function(proxySocket, host, port) {
  CV9BLog.worker('Making SOCKS5 proxy connection...');

  this.sendClientHello(proxySocket);
  this.readServerHello(proxySocket)
  this.sendConnectRequest(proxySocket, host, port)
  this.readConnectResponse(proxySocket, host);

  return proxySocket;
};

SOCKS5Connector.prototype.sendMultiConnectRequest = function(clientSocket, host, port) {
  this.sendClientHello(clientSocket);
  this.readServerHello(clientSocket);
  this.sendConnectRequest(clientSocket, host, port);
};

SOCKS5Connector.prototype.readMultiConnectResponse = function(clientSocket, host) {
  return this.readConnectResponse(clientSocket, host);
};
