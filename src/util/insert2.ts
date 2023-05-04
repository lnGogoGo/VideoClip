import { FFmpeg } from '@ffmpeg/ffmpeg';
import { RcFile } from 'antd/es/upload';

export const splitAndJoinVideo = async (
  ffmpeg: FFmpeg,
  videInfo: {
    startTime: number;
    inputFile: RcFile;
    insertFiles: RcFile[];
  },
) => {
  const { startTime, inputFile, insertFiles = [] } = videInfo;
  // 将输入文件写入到 ffmpeg.FS 中
  const inputFileBuffer = await inputFile.arrayBuffer();
  await ffmpeg.FS('writeFile', inputFile.name, new Uint8Array(inputFileBuffer));
  // 使用 ffmpeg 命令分割视频并在中间插入一段视频
  // 前提，分割成固定帧
  await ffmpeg.run(
    '-i',
    inputFile.name,
    '-ss',
    '00:00:10',
    '-t',
    '00:00:20',
    '-r',
    '60',
    'part2.mp4',
  );
  await ffmpeg.run(
    '-i',
    inputFile.name,
    '-t',
    '00:00:10',
    '-r',
    '60',
    'part1.mp4',
  );
  let arr = [];
  // 将插入文件写入到 ffmpeg.FS 中
  for (let i = 0; i < insertFiles.length; i++) {
    const insertFileBuffer = await insertFiles[i].arrayBuffer();
    await ffmpeg.FS(
      'writeFile',
      insertFiles[i].name,
      new Uint8Array(insertFileBuffer),
    );
    // await ffmpeg.run(
    //   "-i",
    //   insertFiles[i].name,
    //   "-r",
    //   "60",
    //   `iii${insertFiles[i].name}`
    // );
  }

  const inputTxt = [
    'part1.mp4',
    // ...insertFiles.map((item) => `iii${item.name}`),
    ...insertFiles.map((item) => item.name),
    'part2.mp4',
  ].reduce((res, item) => (res += `file ${item}\n`), '');
  await ffmpeg.FS('writeFile', 'input.txt', new Uint8Array(inputTxt.length));
  await ffmpeg.FS('writeFile', 'input.txt', new TextEncoder().encode(inputTxt));
  const reade = await ffmpeg.FS('readFile', 'input.txt');

  const readeb = new Blob([reade.buffer], { type: 'txt' });
  const readeurl = URL.createObjectURL(readeb);

  await ffmpeg.run(
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'input.txt',
    '-c',
    'copy',
    'output.mp4',
  );

  // 从 ffmpeg.FS 中读取输出文件
  const data = await ffmpeg.FS('readFile', 'output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  const data1 = await ffmpeg.FS('readFile', 'part1.mp4');
  const blob1 = new Blob([data1.buffer], { type: 'video/mp4' });
  const url1 = URL.createObjectURL(blob1);
  const data2 = await ffmpeg.FS('readFile', 'part2.mp4');
  const blob2 = new Blob([data2.buffer], { type: 'video/mp4' });
  const url2 = URL.createObjectURL(blob2);

  // 删除临时文件
  await ffmpeg.FS('unlink', 'part1.mp4');
  await ffmpeg.FS('unlink', 'part2.mp4');
  await ffmpeg.FS('unlink', inputFile.name);
  for (let i = 0; i < insertFiles.length; i++) {
    await ffmpeg.FS('unlink', insertFiles[i].name);
  }

  return [url, url1, url2];
};
