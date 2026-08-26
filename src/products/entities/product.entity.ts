import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Item } from '../../inventory/entities/item.entity';
import { GoldTone } from '../enums/gold-tone.enum';
import { ItemCategory } from '../enums/item-category.enum';
import { MetalCategory } from '../enums/metal-category.enum';
import { Supplier } from './supplier.entity';

@Entity('products')
@Index('UQ_products_sku', ['sku'], { unique: true })
@Index('IDX_products_metal_category_item_category', [
  'metalCategory',
  'itemCategory',
])
@Check(
  'CHK_products_gold_tone',
  `"gold_tone" IS NULL OR "metal_category" = 'gold'`,
)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Article number, equal to barcode. Unique scan key. */
  @Column({ length: 64 })
  sku: string;

  @Column()
  name: string;

  /** Weight in grams. */
  @Column({ type: 'numeric', precision: 10, scale: 3 })
  weight: string;

  @Column({
    name: 'metal_category',
    type: 'enum',
    enum: MetalCategory,
    enumName: 'metal_category',
  })
  metalCategory: MetalCategory;

  /** Filled only when metalCategory is gold. */
  @Column({
    name: 'gold_tone',
    type: 'enum',
    enum: GoldTone,
    enumName: 'gold_tone',
    nullable: true,
  })
  goldTone: GoldTone | null;

  @Column({
    name: 'item_category',
    type: 'enum',
    enum: ItemCategory,
    enumName: 'item_category',
  })
  itemCategory: ItemCategory;

  @ManyToOne(() => Supplier, (supplier) => supplier.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Index('IDX_products_supplier_id')
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: string | null;

  /** Purchase / production cost in rubles. Used for margin reports. */
  @Column({ name: 'cost_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  costPrice: string | null;

  @Column({ name: 'out_of_stock', default: false })
  outOfStock: boolean;

  @OneToMany(() => Item, (item) => item.product)
  items: Item[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
