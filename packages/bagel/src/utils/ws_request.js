import {client as Client} from 'websocket';

// Open a websocket connection and send a message
// returns a promise that's resolved when server answers
// This is for testing
const wsRequest = ({data: requestData, url}) => {
  const clientInstance = new Client();

  return new Promise((resolve, reject) => {
    clientInstance.connect(url);

    clientInstance.on('connectFailed', reject);

    clientInstance.on('connect', connection => {
      const sendWebsocketResponse = data => {
        connection.sendUTF(JSON.stringify(data));
        return new Promise(resolve => {
          connection.once('message', responseData => {
            const parsedResponse = JSON.parse(responseData.utf8Data);
            parsedResponse.__connection = connection;
            parsedResponse.__sendWebsocketResponse = sendWebsocketResponse;
            resolve(parsedResponse);
          });
        });
      };

      connection.sendUTF(JSON.stringify(requestData));

      connection.on('message', message => {
        const responseObj = JSON.parse(message.utf8Data);
        responseObj.__connection = connection;
        responseObj.__sendWebsocketResponse = sendWebsocketResponse;
        resolve(responseObj);
      });
    });
  });
};

export default wsRequest;
