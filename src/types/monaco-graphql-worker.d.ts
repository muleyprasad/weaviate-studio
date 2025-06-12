declare module 'monaco-graphql/esm/graphql.worker?worker' {
  const WorkerFactory: {
    new (): Worker;
    prototype: Worker;
  };
  export default WorkerFactory;
}
