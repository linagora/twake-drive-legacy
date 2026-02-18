import React from 'react';
import { Col, Row } from 'antd';
import { AlertTriangle } from 'react-feather';

import Banner from '@components/banner/banner';
import Languages from '@features/global/services/languages-service';
import InitService from '@features/global/services/init-service';

const ReadOnlyBanner = (): JSX.Element => {
  const driveConfig = InitService.server_infos?.configuration?.drive;
  const isReadOnly = driveConfig?.readOnly ?? false;
  const customMessage = driveConfig?.readOnlyMessage;

  if (!isReadOnly) {
    return <></>;
  }

  const defaultMessage = Languages.t(
    'components.read_only_banner.message',
    [],
    'File uploads and modifications are disabled.'
  );

  return (
    <Banner
      height={40}
      type="warning"
      testClassId="read-only-banner"
      content={
        <Row align="middle" gutter={[8, 0]}>
          <Col>
            <AlertTriangle size={16} />
          </Col>
          <Col className="testid:read-only-text">
            <b>{Languages.t('components.read_only_banner.title', [], 'Read-only mode')}</b>
            {' - '}
            {customMessage || defaultMessage}
          </Col>
        </Row>
      }
    />
  );
};

export default ReadOnlyBanner;
