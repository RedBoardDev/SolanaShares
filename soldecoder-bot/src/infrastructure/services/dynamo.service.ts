import {
  DynamoDBClient,
  UpdateItemCommand,
  type UpdateItemCommandInput,
  type UpdateItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  type PutCommandInput,
  type PutCommandOutput,
  GetCommand,
  type GetCommandInput,
  type GetCommandOutput,
  QueryCommand,
  type QueryCommandInput,
  type QueryCommandOutput,
  ScanCommand,
  type ScanCommandInput,
  type ScanCommandOutput,
  DeleteCommand,
  type DeleteCommandInput,
  BatchWriteCommand,
  type BatchWriteCommandInput,
  type BatchWriteCommandOutput,
  UpdateCommand,
  type UpdateCommandInput,
  type UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env';

const credentials = {
  accessKeyId: config.aws.credentials.accessKeyId,
  secretAccessKey: config.aws.credentials.secretAccessKey,
};
const client = new DynamoDBClient({
  region: config.aws.region,
  credentials,
});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export default class DynamoService {
  create = (params: PutCommandInput): Promise<PutCommandOutput> => docClient.send(new PutCommand(params));
  get = (params: GetCommandInput): Promise<GetCommandOutput> => docClient.send(new GetCommand(params));
  query = (params: QueryCommandInput): Promise<QueryCommandOutput> => docClient.send(new QueryCommand(params));
  scan = (params: ScanCommandInput): Promise<ScanCommandOutput> => docClient.send(new ScanCommand(params));
  delete = (params: DeleteCommandInput): Promise<void> => docClient.send(new DeleteCommand(params)).then(() => {});
  batchWrite = (params: BatchWriteCommandInput): Promise<BatchWriteCommandOutput> =>
    docClient.send(new BatchWriteCommand(params));
  update = (params: UpdateCommandInput): Promise<UpdateCommandOutput> => docClient.send(new UpdateCommand(params));
  updateItem = (params: UpdateItemCommandInput): Promise<UpdateItemCommandOutput> =>
    docClient.send(new UpdateItemCommand(params));
}
