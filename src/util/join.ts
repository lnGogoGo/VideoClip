import { FFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

export const join = async (selectedFiles: FileList, ffmpeg: FFmpeg) => {
  let arr = [];
  let list = [...selectedFiles];
  for (let i = 0; i < list.length; i++) {
    // 监听按钮点击事件
    const { name } = list[i];
    const orgFileBuffer = await list[i].arrayBuffer(); // 获取文件数据
    ffmpeg.FS('writeFile', name, await fetchFile(new Blob([orgFileBuffer])));
    arr.push('-i', name);
  }
  // 运行 FFmpeg
  await ffmpeg.run(
    ...[...arr, '-filter_complex', 'concat=n=2:v=1:a=0', 'output.mp4'],
  );
  // 读取合并后的视频文件
  const data = ffmpeg.FS('readFile', 'output.mp4');
  const url = URL.createObjectURL(
    new Blob([data.buffer], { type: 'video/mp4' }),
  );
  const video = document.createElement('video');
  video.src = url;
  video.width = 300;
  video.height = 200;
  video.controls = true;
  document.body.appendChild(video);
};
