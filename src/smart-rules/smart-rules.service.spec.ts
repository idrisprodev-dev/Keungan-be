import { Test, TestingModule } from '@nestjs/testing';
import { SmartRulesService } from './smart-rules.service';

describe('SmartRulesService', () => {
  let service: SmartRulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartRulesService],
    }).compile();

    service = module.get<SmartRulesService>(SmartRulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
