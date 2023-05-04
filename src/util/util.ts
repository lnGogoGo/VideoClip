export const createObjectURL = (date: Uint8Array, type = 'video/mp4') => {
  const blob = new Blob([date.buffer], { type });
  const url = URL.createObjectURL(blob);
  return url;
};

export const changeTimeBySecond = (second: number, showMs = false) => {
  let hourTime = 0;
  let minuteTime = 0;
  let secondTime = 0;
  if (second > 60) {
    //如果秒数大于60
    minuteTime = Math.floor(second / 60);
    secondTime = Math.floor(second % 60);
    if (minuteTime >= 60) {
      //如果分钟大于60
      hourTime = Math.floor(minuteTime / 60);
      minuteTime = Math.floor(minuteTime % 60);
    } else {
      hourTime = 0;
    }
  } else {
    hourTime = 0;
    minuteTime = 0;
    if (second === 60) {
      //如果秒数等于60
      minuteTime = 1;
      secondTime = 0;
    } else {
      secondTime = second;
    }
  }
  const secondInfo = secondTime.toString().split('.');
  let timeResult = `${hourTime.toString().padStart(2, '0')}:${minuteTime
    .toString()
    .padStart(2, '0')}:${secondInfo[0].toString().padStart(2, '0')}${
    showMs ? '.' + (secondInfo[1] || '').toString().padStart(3, '0') : ''
  }`;

  return timeResult;
};

export const downLoadFile = (url: string, name: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', name);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const getFileFromUrl = async (url: string, name: string) => {
  return new Promise((resolve: (file: File) => void) => {
    let blob = null;
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    // 这里设置接收的响应体类型(试了不设置也正常)
    xhr.setRequestHeader(
      'Accept',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    xhr.responseType = 'blob';
    // 加载时处理(异步)
    xhr.onload = () => {
      // 获取返回结果
      blob = xhr.response;
      console.log('blob:', blob);
      let file = new File([blob], name, { type: blob.type });
      resolve(file);
    };
    // 发送
    xhr.send();
  });
};
