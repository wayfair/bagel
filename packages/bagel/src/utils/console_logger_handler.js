// @ flow
const getTimestamp = () => {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();
  const milliseconds = now.getMilliseconds();
  return `${date} ${time}.${milliseconds}`;
};

const consoleHandler = (message, {levelName}) =>
  console.log(
    `[${getTimestamp()}] [PID:${
      process.pid
    }] [${levelName.toUpperCase()}] ${message}`
  );

export default consoleHandler;
