declare module 'multer-s3' {
  type Req = import('express').Request;
  type MulterFile = Express.Multer.File;
  type ValueCallback<T> = (error: Error | null, value?: T) => void;

  interface Options {
    s3: import('@aws-sdk/client-s3').S3Client;
    bucket: string | ((req: Req, file: MulterFile, cb: ValueCallback<string>) => void);
    acl?: string;
    contentType?: (req: Req, file: MulterFile, cb: ValueCallback<string>) => void;
    key?: (req: Req, file: MulterFile, cb: ValueCallback<string>) => void;
    metadata?: (req: Req, file: MulterFile, cb: ValueCallback<Record<string, string>>) => void;
  }

  function multerS3(options: Options): import('multer').StorageEngine;

  namespace multerS3 {
    const AUTO_CONTENT_TYPE: Options['contentType'];
  }

  export = multerS3;
}
