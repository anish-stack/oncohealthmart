const pool = require("../Database/db");

exports.getAllCategory = async (req, res) => {
    try {
        const { categoryId } = req.query;


        let checkCategorySql = `SELECT * FROM cp_category WHERE status = 'Active'`;


        if (categoryId) {
            checkCategorySql += ` AND category_id = ?`;
        }

        // Execute the query, passing categoryId only if it exists
        const [categories] = categoryId
            ? await pool.execute(checkCategorySql, [categoryId])
            : await pool.execute(checkCategorySql);

        // If no categories are found
        if (categories.length === 0) {
            return res.status(404).json({ message: "No categories found." });
        }

        // Update category image paths
        const updatedCategories = categories.map(category => {
            category.category_banner = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${category.category_banner}`;
            category.category_image = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${category.category_image}`;
            return category;
        });

        // Respond with the filtered or full category list
        res.status(200).json({
            success: true,
            count: updatedCategories.length,
            data: updatedCategories,
            message: "Categories fetched successfully."
        });
    } catch (error) {
        console.error("Error fetching categories:", error.message);
        res.status(500).json({ message: "Internal Server Error." });
    }
};

exports.GetAllProduct = async (req, res) => {
    try {
        // Extract query parameters with default values
        const { deal_of_the_day = '0', top_selling = '0', latest_product = '0', category } = req.query;

        // Start building the SQL query
        let sqlQuery = 'SELECT * FROM cp_product WHERE 1=1'; // Base query with a generic condition

        if (deal_of_the_day === '1') {
            sqlQuery += " AND deal_of_the_day = '1'";
        }

        if (top_selling === '1') {
            sqlQuery += " AND top_selling = '1'";
        }

        if (latest_product === '1') {
            sqlQuery += " AND latest_product = '1'";
        } if (category) {
            sqlQuery += ` AND category = ${category}`;
        }

        console.log('Generated SQL Query:', sqlQuery);

        const [products] = await pool.execute(sqlQuery);
        if (products.length === 0) {
            return res.status(404).json({ message: "No products found." });
        }
        const updatedProducts = products.map(product => {
            // Check each image field and only update if it has a valid value
            if (product.image_1) {
                product.image_1 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_1}`;
            }
            if (product.image_2) {
                product.image_2 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_2}`;
            }
            if (product.image_3) {
                product.image_3 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_3}`;
            }
            if (product.image_4) {
                product.image_4 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_4}`;
            }
            if (product.image_5) {
                product.image_5 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_5}`;
            }
            return product;
        });


        res.status(200).json({
            success: true,
            count: updatedProducts.length,
            message: 'Products fetched successfully.',
            data: updatedProducts,
        });
    } catch (error) {
        console.error('Error fetching products:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};
exports.getSingleProduct = async (req, res) => {
    try {
        const productId = req.params.productId;
        const sqlQuery = `SELECT * FROM cp_product WHERE product_id = ?`; // Use parameterized queries to avoid SQL injection
        const [product] = await pool.execute(sqlQuery, [productId]); // Use prepared statement to pass the productId safely

        if (!product || product.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const updatedProduct = product[0]; // Since it's a single product, take the first element of the result
        // Check each image field and only update if it has a valid value
        if (updatedProduct.image_1) {
            updatedProduct.image_1 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${updatedProduct.image_1}`;
        }
        if (updatedProduct.image_2) {
            updatedProduct.image_2 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${updatedProduct.image_2}`;
        }
        if (updatedProduct.image_3) {
            updatedProduct.image_3 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${updatedProduct.image_3}`;
        }
        if (updatedProduct.image_4) {
            updatedProduct.image_4 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${updatedProduct.image_4}`;
        }
        if (updatedProduct.image_5) {
            updatedProduct.image_5 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${updatedProduct.image_5}`;
        }

        res.status(200).json({
            success: true,
            message: 'Product fetched successfully.',
            data: updatedProduct, // Return the updated product with image URLs
        });
    } catch (error) {
        console.error('Error fetching product:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};

exports.GetAllActiveBanners = async (req, res) => {
    try {

        const sqlQuery = `SELECT * FROM cp_banner WHERE status = 'active'`;


        const [banners] = await pool.execute(sqlQuery);


        if (banners.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active banners found.',
                data: [],
            });
        }


        const updatedBanners = banners.map(banner => {

            if (banner.banner_image) {
                banner.banner_image = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${banner.banner_image}`;
            }
            return banner;
        });

        res.status(200).json({
            success: true,
            message: 'Active banners fetched successfully.',
            data: updatedBanners,
        });

    } catch (error) {
        console.error('Error fetching active banners:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};

// Content gets
exports.GetContentOfPage = async (req, res) => {
    try {
        const sqlQuery = `SELECT * FROM cp_content WHERE type = 'Legal'`;
        const [pages] = await pool.execute(sqlQuery);
        if (pages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No content found for the specified type.',
            });
        }
        res.status(200).json({
            success: true,
            message: 'Content fetched successfully.',
            data: pages,
        });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching content.',
            error: error.message,
        });
    }
};





exports.getSearchByInput = async (req, res) => {
    try {
        // Set default values for pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        // Sanitize and extract the search term
        const term = req.query.q ? req.query.q.replace(/'/g, "''") : '';
        console.log(term);

        // Fetch search items with sorting: prioritize products starting with the term
        const searchItemsQuery = `
            SELECT * FROM cp_product 
            WHERE (
                product_name LIKE ? OR 
                salt LIKE ? OR 
                company_name LIKE ?
            )
            AND status = 'Active'
            ORDER BY 
                CASE 
                    WHEN product_name LIKE ? THEN 1  
                    ELSE 2                          
                END,
                product_name
            LIMIT ? OFFSET ?
        `;

        const [allProducts] = await pool.query(searchItemsQuery, [
            `%${term}%`,
            `%${term}%`,
            `%${term}%`,
            `${term}%`, // Match terms that start with the input
            limit,
            offset
        ]);

        // Update image URLs if they exist
        const updatedProducts = allProducts.map(product => {
            if (product.image_1) {
                product.image_1 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_1}`;
            }
            if (product.image_2) {
                product.image_2 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_2}`;
            }
            if (product.image_3) {
                product.image_3 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_3}`;
            }
            if (product.image_4) {
                product.image_4 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_4}`;
            }
            if (product.image_5) {
                product.image_5 = `https://www.oncohealthmart.com${process.env.DIRECTORY_img_upload}/${product.image_5}`;
            }
            return product;
        });

        // Fetch total rows for pagination
        const totalRowsQuery = `
            SELECT COUNT(*) AS total 
            FROM cp_product 
            WHERE (
                product_name LIKE ? OR 
                salt LIKE ? OR 
                company_name LIKE ?
            )
            AND status = 'Active'
        `;
        const [totalRowsResult] = await pool.query(totalRowsQuery, [
            `%${term}%`,
            `%${term}%`,
            `%${term}%`
        ]);
        const totalRows = totalRowsResult[0]?.total || 0;

        // Send the response
        res.status(200).json({
            navTitle: 'Search Results',
            page,
            limit,
            count: updatedProducts.length,
            totalRows: parseInt(totalRows, 10),
            updatedProducts,
        });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({
            message: 'An error occurred while fetching search results.',
            error: error.message,
        });
    }
};


exports.getReviews = async (req, res) => {
    try {
        // Correct SQL query to fetch only active reviews
        const sqlQuery = 'SELECT * FROM cp_reviews WHERE status = "active"';

        // Execute the query and get the results
        const [reviews] = await pool.execute(sqlQuery);

        // Return the reviews as a response
        res.status(200).json({ message: 'Reviews fetched successfully', data: reviews });
    } catch (error) {
        // Handle errors if any occur during the database query
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'An error occurred while fetching reviews', error: error.message });
    }
};


exports.getNews = async (req, res) => {
    try {

        const sqlQuery = 'SELECT * FROM cp_news_table WHERE status = "active" ORDER BY created_at DESC';

        const [news] = await pool.execute(sqlQuery);

        res.status(200).json({ message: 'News fetched successfully', data: news });
    } catch (error) {

        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'An error occurred while fetching news', error: error.message });
    }
};
