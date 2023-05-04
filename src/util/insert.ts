import { FFmpeg } from '@ffmpeg/ffmpeg';

export const splitAndInsertVideo = async (
  ffmpeg: FFmpeg,
  inputFile: File,
  insertFiles: File[],
  startTime: number,
) => {
  // 将输入文件写入到 ffmpeg.FS 中
  const inputFileBuffer = await inputFile.arrayBuffer();
  await ffmpeg.FS('writeFile', inputFile.name, new Uint8Array(inputFileBuffer));
  // 使用 ffmpeg 命令分割视频并在中间插入一段视频
  await ffmpeg.run(
    '-i',
    inputFile.name,
    '-t',
    startTime.toString(),
    '-vf',
    'setpts=0.5*PTS',
    'part1.mp4',
  );
  await ffmpeg.run(
    '-i',
    inputFile.name,
    '-ss',
    startTime.toString(),
    '-c',
    'copy',
    'part2.mp4',
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
    await ffmpeg.run(
      '-i',
      insertFiles[i].name,
      '-vf',
      'setpts=0.5*PTS',
      'insert' + insertFiles[i].name,
    );
    arr.push('-i', 'insert' + insertFiles[i].name);
  }

  // 将三个视频水平排列
  let videoLength = insertFiles.length + 2;
  let list = Array(videoLength).fill('');
  let hstack = '';
  let width = (640 * 3) / videoLength;
  let filter = list.reduce((res, _, index) => {
    let result = res + `[${index}:v]scale=${width}:-2[v${index}];`;
    hstack += `[v${index}]`;
    if (index === videoLength - 1) {
      return (result += `${hstack}hstack=inputs=${videoLength}`);
    }
    return result;
  }, '');
  await ffmpeg.run(
    '-i',
    'part1.mp4',
    ...arr,
    '-i',
    'part2.mp4',
    '-filter_complex',
    filter,
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
