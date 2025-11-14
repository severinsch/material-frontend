import { Configuration, DefaultApi } from './generated';

const config = new Configuration({
    // TODO: update for prod
    basePath: 'http://localhost:8080',
});

export const apiClient = new DefaultApi(config);
