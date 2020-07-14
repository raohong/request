import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom/extend-expect';
import createService from '../src';

const sleep = (wait: number) => new Promise(p => setTimeout(p, wait));
const { CancelToken } = axios;

const server = setupServer(
  rest.get('/', (req, res, ctx) => {
    return res(ctx.json({ text: 'index' }));
  }),
  rest.get('/user/:id', (req, res, ctx) => {
    return res(ctx.json({ text: req.params.id }));
  }),
  rest.put('/user/:id', async (req, res, ctx) => {
    await sleep(1000);

    return res(ctx.json({ text: req.params.id }));
  }),
  rest.delete('/user/:id/:task', async (req, res, ctx) => {
    await sleep(1000);

    return res(ctx.json({ text: req.params.id }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const api = {
  index: 'GET /',
  getUserInfo: 'GET /user/:id',
  updateUserInfo: 'PUT /user/:id',
  deleteUserInfo: 'DELETE /user/:id/:task',
};

describe('测试 createService Axios', () => {
  let c: () => void;
  const CANCEL_KEY = 'CANCEL_KEY';

  const service = createService<typeof api, AxiosRequestConfig, AxiosResponse>(api, axios.request, {
    setParams: (method, params, config) => {
      if (method === 'get') {
        config.params = {
          ...config.params,
          ...params,
        };
      } else {
        config.data = {
          ...config.data,
          ...params,
        };
      }

      config.cancelToken = new CancelToken(function(cancel) {
        c = cancel;
      });

      return config;
    },
    beforeRequest: task => {
      task[CANCEL_KEY] = () => c && c();
    },
  });

  it('index', async () => {
    const index = await service.index();
    expect(index.data.text).toBe('index');
  });

  it('params "id" required', async () => {
    try {
      await service.getUserInfo();
    } catch (e) {
      expect(e).toContain('id');
    }
  });

  it('params id', async () => {
    const {
      data: { text },
    } = await service.getUserInfo({ params: { id: 1 } });

    expect(text).toBe('1');
  });

  it('expect :task', async () => {
    try {
      await service.deleteUserInfo({ params: { id: 1 } });
    } catch (e) {
      expect(e).toContain('task');
    }
  });

  it('cancel', async () => {
    try {
      const task = service.updateUserInfo({ params: { id: 1 } });

      task[CANCEL_KEY]();
    } catch (e) {
      expect(axios.isCancel(e)).toBeTruthy();
    }
  });
});
