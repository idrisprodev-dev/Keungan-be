import { Test, TestingModule } from '@nestjs/testing';
import { SmartRulesController } from './smart-rules.controller';

describe('SmartRulesController', () => {
  let controller: SmartRulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmartRulesController],
    }).compile();

    controller = module.get<SmartRulesController>(SmartRulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
