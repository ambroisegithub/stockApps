import app from './app';
import { DbConnection } from './database';
const PORT = process.env.PORT || 3005;

(async () => {
  await DbConnection.instance.initializeDb();
  
  app.listen(PORT, () => console.log(`App is up and listening to ${PORT}`));
})();