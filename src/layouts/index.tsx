import { Link, Outlet } from 'umi';
import styles from './index.less';

export default function Layout() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>前端视频剪辑</div>
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  );
}
