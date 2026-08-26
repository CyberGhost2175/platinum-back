import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { CATALOG_SEARCH } from './catalog-search.tokens';
import { CatalogSearchService } from './catalog-search.service';
import { ElasticsearchCatalogSearchService } from './elasticsearch-catalog-search.service';
import { PostgresCatalogSearchService } from './postgres-catalog-search.service';

@Module({
  providers: [
    PostgresCatalogSearchService,
    ElasticsearchCatalogSearchService,
    {
      provide: CATALOG_SEARCH,
      inject: [
        ConfigService,
        PostgresCatalogSearchService,
        ElasticsearchCatalogSearchService,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        postgres: PostgresCatalogSearchService,
        elasticsearch: ElasticsearchCatalogSearchService,
      ): CatalogSearchService => {
        const driver = config.get('CATALOG_SEARCH_DRIVER', { infer: true });
        return driver === 'elasticsearch' ? elasticsearch : postgres;
      },
    },
  ],
  exports: [CATALOG_SEARCH],
})
export class CatalogSearchModule {}
