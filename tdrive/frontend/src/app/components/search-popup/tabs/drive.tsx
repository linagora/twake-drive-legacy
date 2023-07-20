import * as Text from '@atoms/text';
import Languages from '@features/global/services/languages-service';
import { useSearchDriveItems } from '@features/search/hooks/use-search-drive-items';
import { SearchInputState } from '@features/search/state/search-input';
import { useRecoilValue } from 'recoil';
import DriveItemResult from '../parts/drive-item-result';
import NothingFound from '../parts/nothing-found';

export default () => {
  const input = useRecoilValue(SearchInputState);
  const isRecent = input?.query?.trim()?.length === 0;
  const { driveItems, loading } = useSearchDriveItems();

  if (driveItems.length === 0 && !loading) return <NothingFound />;

  return (
    <div>
      {!!isRecent && (
        <Text.Subtitle className="block">
          {Languages.t('components.searchpopup.recent_files')}
        </Text.Subtitle>
      )}

      <div className={'-mx-2'}>
        <DriveItemsResults/>
      </div>
    </div>
  );
};

export const DriveItemsResults = (props: { max?: number}) => {
  const { driveItems, loading } = useSearchDriveItems();

  if (driveItems.length === 0 && !loading) return <NothingFound />;

  return (
    <>
      {driveItems.slice(0, props?.max || driveItems.length).map(item => (
        <DriveItemResult key={item.id} driveItem={item}/>
      ))}
    </>
  );
};
