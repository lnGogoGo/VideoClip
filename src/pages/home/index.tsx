import {
  changeTimeBySecond,
  createObjectURL,
  downLoadFile,
  getFileFromUrl,
} from '@/util/util';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { CloseOutlined, UploadOutlined } from '@ant-design/icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Space,
  Upload,
  UploadFile,
  Image,
  Col,
  Row,
  Slider,
  InputNumber,
  Form,
  Radio,
  TabsProps,
  Tabs,
  Input,
} from 'antd';
import styles from './index.css';
import { RcFile } from 'antd/es/upload';
import { Timeline, TimelineAction } from '@xzdarcy/react-timeline-editor';

interface TimelineCustomAction extends TimelineAction {
  name?: string;
}

interface VideoUploadProps {
  onSubmit: (videoInfo: VideoInfo) => void;
}

interface VideoInfo {
  name: string;
  duration: number;
  videoUrl: any;
  vttUrl?: string;
}

enum SPLIT {
  '时间',
  '平均',
}

const fontSrc = `${location.href}font/SourceSansPro-Bold.ttf`;

const ffmpeg = createFFmpeg({
  corePath: `${location.href}dist/ffmpeg-core.js`,
  log: true,
});

const VideoUpload: React.FC<VideoUploadProps> = () => {
  const [form] = Form.useForm();
  const [activeKey, setActiveKey] = useState('1');
  const videoRef = useRef<HTMLVideoElement>(null);
  // 源文件
  const [baseFile, setSelectedFile] = useState<RcFile>();
  // 视频基本信息
  const [videoInfo, setVideoInfo] = useState<VideoInfo>();
  // 1s帧信息
  const [imgList, setImageList] = useState<string[]>();
  // 字幕list
  const [captionsList, setCaptionsList] = useState<TimelineCustomAction[]>([]);
  // 字幕id
  const idRef = useRef(0);
  // 轨道宽度
  const [scaleWidth, setScaleWidth] = useState(160);
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);

  // 分割时间点
  const [splitTime, setSplitTime] = useState<number>(0);
  const [splitList, setSplitList] = useState<string[]>([]);

  // 操作后的url
  const [handleUrl, setHandleUrl] = useState('');
  // 移动后的url
  const [changeUrl, setChangeUrl] = useState('');
  const [ready, setReady] = useState(false);

  const getDuration = async (aBlob: RcFile): Promise<number> => {
    return new Promise((res) => {
      const oVideo = document.createElement('video');
      oVideo.src = URL.createObjectURL(aBlob);
      // oVideo.preload = 'metadata';
      oVideo.onloadedmetadata = function () {
        res(oVideo.duration);
      };
    });
  };

  // 读取帧
  const getVideoFrames = async () => {
    if (!baseFile) return;
    const { name } = baseFile;
    const duration: number = await getDuration(baseFile);
    const dataBuffer = await fetchFile(baseFile);
    await ffmpeg.FS('writeFile', name, dataBuffer);
    const videoUrl = createObjectURL(dataBuffer);
    const frames: any[] = [];
    // 读取帧 fps 每秒几张
    await ffmpeg.run('-i', name, '-vf', 'fps=1', 'output-%03d.png');
    const files = ffmpeg
      .FS('readdir', '/')
      .filter((file) => file.endsWith('.png'));
    console.log(files);
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      console.log(fileName);
      const data = await ffmpeg.FS('readFile', fileName);
      let blob = new Blob([data]);
      let url = URL.createObjectURL(blob);
      frames.push(url);
      await ffmpeg.FS('unlink', fileName);
    }
    setImageList(frames);
    setVideoInfo({
      duration,
      name,
      videoUrl,
    });
  };

  // @ts-ignore
  useEffect(() => {
    if (!baseFile) {
      return;
    }
    let { name } = baseFile;
    async function write() {
      if (!baseFile) {
        return;
      }
      const orgFileBuffer = await baseFile.arrayBuffer(); // 获取文件数据
      ffmpeg.FS('writeFile', name, await fetchFile(new Blob([orgFileBuffer]))); // 将视频数据写入内存
      getVideoFrames();
    }
    write();
    return () => {
      async function unlink() {
        await ffmpeg.FS('unlink', name);
      }
      unlink();
    };
  }, [baseFile]);

  // 截取视频
  const interceptVideo = async ([start, end]: number[], showUrl = true) => {
    if (!baseFile || !(start - end)) return;
    const createName = `${Date.now()}.mp4`;
    const { name } = baseFile;
    await ffmpeg.run(
      '-i',
      name, //文件名
      '-ss',
      `${changeTimeBySecond(start)}`, //开始时间
      '-t',
      `${changeTimeBySecond(end - start)}`, //截取长度
      '-r',
      '60',
      createName, //保存的文件名
    );

    let arrayBuffer = await ffmpeg.FS('readFile', createName); // 读取缓存
    const url = createObjectURL(arrayBuffer);
    if (showUrl) {
      setHandleUrl(url);
    }
    return createName;
  };

  // 删除片段
  const deletePart = async ([start, end]: number[]) => {
    if (!baseFile || !(start - end)) return;
    const { name } = baseFile;

    if (start !== 0) {
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-t',
        `${changeTimeBySecond(start)}`,
        '-avoid_negative_ts',
        '1',
        'cut1.mp4',
      );
    }
    if (end !== imgList?.length) {
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(end)}`,
        '-avoid_negative_ts',
        '1',
        'cut2.mp4',
      );
    }
    if (start === 0 || end === imgList?.length) {
      let arrayBuffer = await ffmpeg.FS(
        'readFile',
        `cut${start === 0 ? 2 : 1}.mp4`,
      ); // 读取缓存
      const url = createObjectURL(arrayBuffer);
      setHandleUrl(url);
      return;
    }

    const inputTxt = ['cut1.mp4', 'cut2.mp4'].reduce((result, item) => {
      return result + `file ${item}\n`;
    }, '');
    await ffmpeg.FS('writeFile', 'input.txt', new Uint8Array(inputTxt.length));
    await ffmpeg.FS(
      'writeFile',
      'input.txt',
      new TextEncoder().encode(inputTxt),
    );
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

    let arrayBuffer = await ffmpeg.FS('readFile', 'output.mp4'); // 读取缓存
    const url = createObjectURL(arrayBuffer);
    setHandleUrl(url);
  };

  // 改版片段
  const changePart = async ([start, end]: number[], insertTime: number) => {
    if (!baseFile || !(start - end)) return;
    const { name } = baseFile;

    const partName = await interceptVideo([start, end], false);
    let list = [];
    // 移动位置在前面
    if (insertTime < start) {
      // 移入点前的内容
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-t',
        `${changeTimeBySecond(insertTime)}`,
        '-avoid_negative_ts',
        '1',
        'cut1.mp4',
      );
      list.push('cut1.mp4');
      // 移入内容
      list.push(partName);
      // 移入点后到开始的内容
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(insertTime)}`,
        '-t',
        `${changeTimeBySecond(start - insertTime)}`,
        '-avoid_negative_ts',
        '1',
        'cut2.mp4',
      );
      list.push('cut2.mp4');
      // 结束后的内容

      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(end)}`,
        '-avoid_negative_ts',
        '1',
        'cut3.mp4',
      );
      list.push('cut3.mp4');
    } else {
      // 移入位置在后
      // 开始点前的内容
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(start)}`,
        '-avoid_negative_ts',
        '1',
        'cut1.mp4',
      );
      list.push('cut1.mp4');

      // 结束点到移入点的内容
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(end)}`,
        '-t',
        `${changeTimeBySecond(insertTime - end)}`,
        '-avoid_negative_ts',
        '1',
        'cut2.mp4',
      );
      list.push('cut2.mp4');
      // 移入内容
      list.push(partName);
      // 移入点后的内容
      await ffmpeg.run(
        '-copyts',
        '-i',
        name,
        '-ss',
        `${changeTimeBySecond(insertTime)}`,
        '-avoid_negative_ts',
        '1',
        'cut3.mp4',
      );
      list.push('cut3.mp4');
    }

    const inputTxt =
      list.reduce((result, item) => {
        return result + `file ${item}\n`;
      }, '') || '';
    console.log(inputTxt, list);

    await ffmpeg.FS('writeFile', 'input.txt', new Uint8Array(inputTxt.length));
    await ffmpeg.FS(
      'writeFile',
      'input.txt',
      new TextEncoder().encode(inputTxt),
    );
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

    let arrayBuffer = await ffmpeg.FS('readFile', 'output.mp4'); // 读取缓存
    const url = createObjectURL(arrayBuffer);
    setChangeUrl(url);
  };

  const splitVideo = async (time: number, type: SPLIT) => {
    if (!baseFile || time === 0 || !imgList?.length) return;
    const { name } = baseFile;
    console.log(name);
    const orgFileBuffer = await baseFile.arrayBuffer(); // 获取文件数据
    console.log(orgFileBuffer.byteLength);
    ffmpeg.FS('writeFile', name, await fetchFile(new Blob([orgFileBuffer])));
    if (type === SPLIT.时间) {
      await ffmpeg.run(
        '-i',
        name, //文件名
        '-t',
        time.toString(),
        '-r',
        '60',
        'output_001.mp4', //保存的文件名
      );
      await ffmpeg.run(
        '-i',
        name, //文件名
        '-ss',
        time.toString(),
        '-r',
        '60',
        'output_002.mp4', //保存的文件名
      );
    } else {
      await ffmpeg.run(
        '-i',
        name,
        '-c',
        'copy',
        '-segment_time', // 每10秒进行一次分割
        '10',
        '-f', // 输出为分段视频
        'segment',
        '-reset_timestamps', //开头时间戳
        '1',
        'output_%03d.mp4',
      );
    }

    const files = ffmpeg
      .FS('readdir', '/')
      .filter((file) => file.endsWith('.mp4') && file.startsWith('output_'));

    let result = [];
    for (let i = 0; i < files.length; i++) {
      let name = files[i];
      let data = await ffmpeg.FS('readFile', name);
      const url = createObjectURL(data);
      result.push(url);
      await ffmpeg.FS('unlink', name);
    }
    setSplitList(result);
  };

  const load = async () => {
    await ffmpeg.load().catch((err) => {
      console.log(err);
    });
    setReady(true);
  };

  React.useEffect(() => {
    load();
  }, []);

  // 缩放视频帧文案
  const CustomScale = (props: { scale: number; scaleWidth: number }) => {
    const { scale } = props;
    if (scaleWidth < 40) {
      return <></>;
    }
    const min = parseInt(scale / 60 + '')
      .toString()
      .padStart(2, '0');
    const second = (scale % 60).toString().padStart(2, '0');
    return <>{`${min}:${second}`}</>;
  };

  const Captions = ({ info }: { info?: string }) => {
    return (
      <div
        onKeyDown={(e) => {
          console.log(e);
        }}
        className={styles.captions}
      >
        {info}
      </div>
    );
  };

  // 生成字幕文件
  const createCaptionFile = async () => {
    if (!baseFile || !videoInfo) {
      return;
    }
    const { name } = baseFile;
    const fileText = captionsList.reduce((res, item) => {
      const { start, end, name } = item;
      return (
        res +
        `${changeTimeBySecond(start, true)} --> ${changeTimeBySecond(
          end,
          true,
        )}\n${name}\n\n`
      );
    }, "WEBVTT\n\nSTYLE\n::cue {\nfont-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji';\ncolor: red;\n}\n\n ");
    console.log(fileText);
    await ffmpeg.FS('writeFile', 'output.vtt', new Uint8Array(fileText.length));
    await ffmpeg.FS(
      'writeFile',
      'output.vtt',
      new TextEncoder().encode(fileText),
    );

    // await ffmpeg.run(
    //   '-i',
    //   name,
    //   '-i',
    //   'output.vtt',
    //   '-c:v',
    //   'copy',
    //   '-c:a',
    //   'copy',
    //   '-c:s',
    //   'mov_text',
    //   'output.mp4',
    // );
    ffmpeg.FS(
      'writeFile',
      'tmp/SourceSansPro-Bold',
      await fetchFile(fontSrc),
    );
    const files = ffmpeg.FS('readdir', '/tmp');
    console.log(files);
    await ffmpeg.run(
      '-i',
      name,
      '-vf',
      "subtitles=output.vtt:fontsdir=/tmp:force_style='Fontname=Source Sans Pro'",
      'output.mp4',
    );
    let arrayBuffer = await ffmpeg.FS('readFile', 'output.mp4'); // 读取缓存
    let srt = await ffmpeg.FS('readFile', 'output.vtt'); // 读取缓存

    const url = createObjectURL(arrayBuffer);
    const srtUrl = createObjectURL(srt);
    setVideoInfo({
      ...videoInfo,
      videoUrl: url,
      vttUrl: srtUrl,
    });
    // downLoadFile(srtUrl, 'output.vtt');
  };

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: '视频管理',
      children: (
        <>
          <div className={styles.handleContent}>
            <Form
              form={form}
              name="basic"
              labelCol={{ span: 3 }}
              wrapperCol={{ span: 12 }}
              autoComplete="off"
              initialValues={{
                type: SPLIT.时间,
                number: splitTime,
              }}
            >
              <Form.Item label="方式" name="type">
                <Radio.Group>
                  <Radio value={SPLIT.时间}>按时间</Radio>
                  <Radio value={SPLIT.平均}>平均</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="时间|数量" name="number">
                <InputNumber max={imgList?.length} min={1} />
              </Form.Item>
            </Form>
            <Button
              type="primary"
              htmlType="submit"
              onClick={() => {
                const result = form.getFieldsValue();
                console.log(result);
                if (result.type === SPLIT.时间) {
                  return splitVideo(result.number || splitTime, SPLIT.时间);
                }
                return splitVideo(parseInt(result.number), SPLIT.平均);
              }}
            >
              分割视频
            </Button>
            {splitList.length ? (
              <>
                <div>分割后的视频：</div>
                {splitList.map((item) => (
                  <video key={item} height={200} src={item} controls />
                ))}
              </>
            ) : null}
          </div>
          <div className={styles.handleContent}>
            <Form
              form={form}
              name="basic"
              labelCol={{ span: 3 }}
              wrapperCol={{ span: 12 }}
              autoComplete="off"
              initialValues={{
                times: [0, 0],
              }}
            >
              <Form.Item label="时间段" name="times">
                <Slider
                  tooltip={{
                    open: true,
                    getPopupContainer: (triggerNode) => triggerNode,
                  }}
                  range={true}
                  min={0}
                  max={imgList?.length}
                />
              </Form.Item>
              <Button.Group>
                <Button
                  type="primary"
                  onClick={() => {
                    const result = form.getFieldsValue();
                    deletePart(result.times);
                  }}
                >
                  删除片段
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    const result = form.getFieldsValue();
                    console.log(result);
                    interceptVideo(result.times);
                  }}
                >
                  剪辑片段
                </Button>
                {handleUrl ? (
                  <>
                    <video
                      key={handleUrl}
                      height={200}
                      src={handleUrl}
                      controls
                    />
                  </>
                ) : null}
              </Button.Group>
            </Form>
          </div>
          <div className={styles.handleContent}>
            <Form
              form={form}
              name="basic"
              labelCol={{ span: 3 }}
              wrapperCol={{ span: 12 }}
              autoComplete="off"
              initialValues={{
                rang: [4, 7],
                end: 1,
              }}
            >
              <Form.Item label="时间段" name="rang">
                <Slider
                  tooltip={{
                    open: true,
                    getPopupContainer: (triggerNode) => triggerNode,
                  }}
                  range={true}
                  min={0}
                  max={imgList?.length}
                />
              </Form.Item>
              <Form.Item label="时间段" name="end">
                <Slider
                  tooltip={{
                    open: true,
                    getPopupContainer: (triggerNode) => triggerNode,
                  }}
                  min={0}
                  max={imgList?.length}
                />
              </Form.Item>
              <Button.Group>
                <Button
                  type="primary"
                  onClick={() => {
                    const result = form.getFieldsValue();
                    changePart(result.rang, result.end);
                  }}
                >
                  切换片段
                </Button>
                {changeUrl ? (
                  <>
                    <video
                      key={changeUrl}
                      height={200}
                      src={changeUrl}
                      controls
                    />
                  </>
                ) : null}
              </Button.Group>
            </Form>
          </div>
        </>
      ),
    },
    {
      key: '2',
      label: '字幕管理',
      children: (
        <div>
          <Button
            type="primary"
            onClick={() => {
              if (!captionsList.length) {
                return;
              }
              createCaptionFile();
            }}
          >
            预览
          </Button>
          {captionsList.map((item, index) => (
            <div key={item.id} className={styles.captionItem}>
              <CloseOutlined
                style={{
                  color: '#eee',
                }}
                onClick={() => {
                  const newList = [...captionsList];
                  newList.splice(index, 1);
                  setCaptionsList(newList);
                }}
              />
              <div className={styles.captionTime}>
                {changeTimeBySecond(item.start)}~{changeTimeBySecond(item.end)}
              </div>
              <Input
                className={styles.captionInfo}
                placeholder="可在此输入文本"
                autoComplete="off"
                value={item.name}
                onChange={(e) => {
                  const cur = JSON.parse(JSON.stringify(captionsList));
                  cur[index].name = e.target.value;
                  setCaptionsList(cur);
                }}
                bordered={false}
              />
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {ready ? (
        <Space align="start" style={{ marginBottom: '20px' }}>
          <label
            style={{
              lineHeight: '32px',
            }}
            htmlFor="file-upload"
          >
            选择你的视频
          </label>
          <Upload
            id="file-upload"
            onChange={({ file, fileList }) => {
              setSelectedFile(file.originFileObj);
              setSelectedFiles(fileList);

              return false;
            }}
            accept=".mp4"
            listType="text"
            maxCount={1}
            fileList={selectedFiles}
          >
            <Button icon={<UploadOutlined />}>Click to Upload</Button>
          </Upload>
          <Button
            type="primary"
            htmlType="submit"
            onClick={() => {
              getVideoFrames();
            }}
          >
            开始
          </Button>
        </Space>
      ) : null}
      {videoInfo && imgList ? (
        <Row gutter={16}>
          <Col span={12}>
            <Tabs
              activeKey={activeKey}
              onChange={(e) => setActiveKey(e)}
              tabPosition="left"
              items={items}
            />
          </Col>
          <Col span={12}>
            <Space>
              <span>原视频</span>
            </Space>
            <video
              ref={videoRef}
              controls
              height={200}
              style={{
                display: 'block',
              }}
              src={videoInfo.videoUrl}
            >
              <track default kind="captions" src={videoInfo.vttUrl}></track>
            </video>
            <Slider
              defaultValue={scaleWidth}
              min={1}
              max={500}
              onChange={(e) => {
                setScaleWidth(e);
              }}
            />
            <Timeline
              style={{
                height: '300px',
                width: '100%',
              }}
              minScaleCount={imgList?.length}
              maxScaleCount={imgList?.length + 1}
              editorData={[
                {
                  id: 'captions',
                  selected: true,
                  actions: captionsList.map((item) => {
                    return {
                      ...item,
                      movable: true,
                      selected: true,
                    };
                  }),
                },
                {
                  id: 'iframe',
                  actions: imgList.map((item, index) => {
                    return {
                      id: item,
                      start: index,
                      end: index + 1,
                      effectId: 'iframe',
                      movable: false,
                    };
                  }),
                },
              ]}
              effects={{
                captions: {
                  id: 'captions',
                  name: '字幕',
                },
                iframe: {
                  id: 'iframe',
                  name: '视频帧',
                },
              }}
              getActionRender={(action: TimelineCustomAction) => {
                if (action.effectId === 'iframe') {
                  return <Image preview={false} src={action.id} />;
                }
                if (action.effectId === 'captions') {
                  return <Captions info={action?.name} />;
                }
              }}
              onCursorDragEnd={(e) => {
                console.log();
                if (videoRef.current) {
                  videoRef.current.currentTime = e;
                  setSplitTime(e);
                }
              }}
              onClickTimeArea={(tiem) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = tiem;
                  setSplitTime(tiem);
                }
                return true;
              }}
              scaleWidth={scaleWidth}
              autoReRender={false}
              autoScroll={true}
              getScaleRender={(scale) => (
                <CustomScale scale={scale} scaleWidth={scaleWidth} />
              )}
              onDoubleClickRow={(e, { row, time }) => {
                console.log(e, row, time);
                if (row.id === 'captions') {
                  // 已有字幕不允许多加
                  if (
                    captionsList.some(
                      (item) =>
                        item.start < time && item.end > Math.floor(time),
                    )
                  ) {
                    return;
                  }
                  const newAction: TimelineCustomAction = {
                    id: `action${idRef.current++}`,
                    start: Math.floor(time),
                    end: Math.floor(time) + 1,
                    effectId: 'captions',
                    name: `aaaaaa${idRef.current}`,
                  };
                  setCaptionsList([...captionsList, newAction]);
                  setActiveKey('2');
                }
              }}
              onChange={(editorData) => {
                console.log(editorData);
                const captionActions = editorData
                  .filter((item) => item.id === 'captions')[0]
                  .actions.sort((a, b) => a.start - b.start);
                const newList: TimelineCustomAction[] = [];
                let currentEnd = 0;
                captionActions.forEach((item) => {
                  if (item.start >= currentEnd) {
                    newList.push({
                      ...item,
                      start: +item.start.toFixed(3),
                      end:
                        item.end > imgList.length
                          ? imgList.length
                          : +item.end.toFixed(3),
                    });
                    currentEnd = +item.end.toFixed(3);
                  } else if (item.end > currentEnd) {
                    newList.push({
                      ...item,
                      end: +item.end.toFixed(3),
                      start: currentEnd,
                    });
                    currentEnd = +item.end.toFixed(3);
                  }
                });
                setCaptionsList(newList);
              }}
              onContextMenuAction={(e, params) => {
                e.stopPropagation();
                e.preventDefault();
                console.log(e, params);
              }}
            />
          </Col>
        </Row>
      ) : null}
    </div>
  );
};

export default VideoUpload;
