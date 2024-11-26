import { lazy, Suspense } from 'react';
const Shared = lazy(() => import('@views/client/body/drive/shared'));

export default () => {
  return (
    <Suspense fallback={<></>}>
      <Shared />
    </Suspense>
  );
};
