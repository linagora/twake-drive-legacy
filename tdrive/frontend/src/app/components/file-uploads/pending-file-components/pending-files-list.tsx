import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { Minus, Plus } from 'react-feather';
import { Layout, Row, Col, Typography } from 'antd';
import PerfectScrollbar from 'react-perfect-scrollbar';
import moment from 'moment';

import PendingFileRow from './pending-file-row';
import Languages from '@features/global/services/languages-service';
import { PendingFileRecoilType } from '@features/files/types/file';
import { useUpload } from '@features/files/hooks/use-upload';

import './styles.scss';

type PropsType = {
  pendingFilesState: PendingFileRecoilType[];
  visible: boolean;
};

const { Text } = Typography;
const { Header, Content } = Layout;
export default ({ pendingFilesState, visible }: PropsType) => {
  const { getOnePendingFile, currentTask } = useUpload();
  const [hiddenPendingFiles, setHiddenPendingFiles] = useState<boolean>(false);

  const handleTimeChange = useCallback(() => {
    const pendingFiles = pendingFilesState.map(state => getOnePendingFile(state.id));
    const uploadingFiles = pendingFiles.filter(f => f?.resumable && f.resumable.isUploading());

    const remainingSizeTotal = uploadingFiles
      .map(f => (1 - f.progress) * (f?.originalFile?.size || 0))
      .reduce((accumulator: number, nextValue: number) => accumulator + nextValue, 0);

    const speed =
      uploadingFiles
        .map(f => f.speed)
        .reduce((accumulator: number, nextValue: number) => accumulator + nextValue, 0) /
      uploadingFiles.map(f => f.speed).length;

    const timeRemainingInMs = remainingSizeTotal / speed;

    const momentTimeRemaining = moment(new Date().getTime() + timeRemainingInMs).fromNow();

    if (momentTimeRemaining !== 'Invalid date') {
      return Languages.t('components.pending_file_list.estimation.end') + ` ${momentTimeRemaining}...`;
    } else {
      return Languages.t('components.pending_file_list.estimation.approximations');
    }
  }, [getOnePendingFile, pendingFilesState]);

  return pendingFilesState.length > 0 ? (
    <Layout className={'pending-files-list-layout ' + (visible ? 'visible' : '')}>
      <Header
        className={classNames('pending-files-list-header', {
          hidden: hiddenPendingFiles,
        })}
        onClick={() => setHiddenPendingFiles(!hiddenPendingFiles)}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Text style={{ color: 'var(--white)' }}>
              {currentTask.total > 0 && `${currentTask.uploaded}/${currentTask.total} `}
              {Languages.t('components.drive_dropzone.uploading')}
            </Text>
          </Col>
          <Col style={{ display: 'flex', alignItems: 'center' }}>
            {hiddenPendingFiles ? <Plus size={18} /> : <Minus size={18} />}
          </Col>
        </Row>
      </Header>
      {!hiddenPendingFiles && (
        <Content className="pending-files-list-content">
          <PerfectScrollbar
            options={{ suppressScrollX: true, suppressScrollY: false }}
            component="div"
            style={{ width: '100%', height: 114 }}
          >
            <Row justify="start" align="middle" style={{ background: '#DFE7FE' }}>
              <Col className="small-left-margin">
                <Text style={{ color: '#6C6C6D' }}>{handleTimeChange()}</Text>
              </Col>
            </Row>

            <>
              {pendingFilesState.length > 0 &&
                pendingFilesState.map((pendingFileState, index) => (
                  <PendingFileRow
                    key={`${pendingFileState.file?.id}-${index}`}
                    pendingFileState={pendingFileState}
                    pendingFile={getOnePendingFile(pendingFileState.id)}
                  />
                ))}
            </>
          </PerfectScrollbar>
        </Content>
      )}
    </Layout>
  ) : (
    <></>
  );
};
