import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { CatalogSearchService } from './catalog-search.service';
import {
  CatalogSearchHit,
  CatalogSearchOptions,
  ProductSearchDocument,
} from './catalog-search.types';

/**
 * Drop-in replacement for {@link PostgresCatalogSearchService}.
 * Enable with CATALOG_SEARCH_DRIVER=elasticsearch and implement the client
 * against ELASTICSEARCH_NODE. Controllers stay unchanged.
 */
@Injectable()
export class ElasticsearchCatalogSearchService implements CatalogSearchService {
  private readonly logger = new Logger(ElasticsearchCatalogSearchService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async search(
    _query: string,
    _options?: CatalogSearchOptions,
  ): Promise<CatalogSearchHit[]> {
    const node = this.config.get('ELASTICSEARCH_NODE', { infer: true });
    throw new ServiceUnavailableException(
      node
        ? 'Elasticsearch catalog search is not implemented yet'
        : 'ELASTICSEARCH_NODE is not configured',
    );
  }

  async upsert(document: ProductSearchDocument): Promise<void> {
    this.logger.debug(
      `Would index product ${document.id} (${document.sku}) into Elasticsearch`,
    );
  }

  async remove(productId: string): Promise<void> {
    this.logger.debug(`Would delete product ${productId} from Elasticsearch`);
  }
}
