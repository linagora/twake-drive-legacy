import { SearchIcon } from "@heroicons/react/solid";
import { useEffect, useRef } from "react";
import { useRecoilState } from "recoil";
import { InputDecorationIcon } from "@atoms/input/input-decoration-icon";
import { Input } from "@atoms/input/input-text";
import { Loader } from "@atoms/loader";
import Languages from "@features/global/services/languages-service";
import { useSearchDriveItemsLoading } from "@features/search/hooks/use-search-drive-items";
import { SearchInputState } from "@features/search/state/search-input";

export const SearchInput = () => {
  const [input, setInput] = useRecoilState(SearchInputState);

  const inputElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputElement.current) inputElement.current.focus();
  }, []);

  const loading = useSearchDriveItemsLoading();

  return (
    <div className="relative flex mt-2 w-full">
      <InputDecorationIcon
        className="grow"
        prefix={
          loading
            ? ({ className }) => (
                <div className={className + ' !h-6'}>
                  <Loader className="h-4 w-4" />
                </div>
              )
            : SearchIcon
        }
        input={({ className }) => (
          <Input
            inputRef={inputElement}
            onChange={e => setInput({ ...input, query: e.target.value })}
            value={input.query}
            className={className}
            placeholder={Languages.t('scenes.app.mainview.quick_search_placeholder')}
          />
        )}
      />
    </div>
  );
};
