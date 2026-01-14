import { OpenAIAssistantService, createAssistantService } from './AssistantService';

describe('AssistantService', () => {
  let service: OpenAIAssistantService;

  beforeEach(() => {
    service = new OpenAIAssistantService();
  });

  it('should create an instance', () => {
    expect(service).toBeInstanceOf(OpenAIAssistantService);
  });
});

describe('createAssistantService factory', () => {
  it('should create AssistantService instance', () => {
    const service = createAssistantService();
    expect(service).toBeInstanceOf(OpenAIAssistantService);
  });
});