import findRoot from 'find-root';


jest.mock('fs-extra');
jest.mock('find-root');

const findRootMock = findRoot as jest.Mock;

findRootMock.mockReturnValue('/');
