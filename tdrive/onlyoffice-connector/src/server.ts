import App from '@/app';
import IndexRoute from './routes/index.route';
import OnlyOfficeRoute from './routes/onlyoffice.route';

const app = new App([new IndexRoute(), new OnlyOfficeRoute()]);

app.listen();
