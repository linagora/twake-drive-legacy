import { ViewGridIcon } from '@heroicons/react/outline';
import { Button } from '@atoms/button/button';
import Menu from '@components/menus/menu';
import { Base } from '../../../atoms/text';
import InitService from '../../../features/global/services/init-service';

export default ({ className }: { className?: string }): JSX.Element => {
  const applications = InitService?.server_infos?.configuration?.app_grid || [];

  if (applications.length === 0) {
    return <></>;
  }

  return (
    <Menu
      position="bottom"
      toggle="true"
      menu={[
        {
          type: 'react-element',
          reactElement: (
            <div className="grid grid-cols-3 -m-2">
              {applications.map((app, index) => {
                return (
                  <a
                    key={index}
                    target="_blank"
                    rel="noreferrer"
                    href={app.url}
                    className="inline-block flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md p-2 pb-1"
                  >
                    <img src={app.logo} className="w-11 h-11 mb-1" />
                    <Base style={{
                      fontSize: '0.75rem',
                      lineHeight: '1.4rem',
                    }}>{app.name}</Base>
                  </a>
                );
              })}
            </div>
          ),
        },
      ]}
    >
      <Button
        theme="default"
        size="md"
        className={'!rounded-full border-0 ' + className}
        icon={() => <ViewGridIcon className="w-6 h-6 text-blue-500" />}
      />
    </Menu>
  );
};
